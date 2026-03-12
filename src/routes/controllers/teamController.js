//                                    javascript 
const Team = require('../models/Team');
const { getEntitlementsFor } = require('../utils/entitlements');


function resolveTeamEntitlements(req) {
  const org = req._org || {};
  const entitlements = req.entitlements || getEntitlementsFor(org);
  // cache no req para reuso em outras rotas
  req.entitlements = entitlements;

  const limits = entitlements.limits || {};
  const features = entitlements.features || {};

  const maxTeams =
    typeof limits.teamsPerOrg === 'number' ? limits.teamsPerOrg : null;

  return { entitlements, limits, features, maxTeams };
}


const createTeam = async (req, res) => {
  try {
    // 🔎 LOGS DE DIAGNÓSTICO (cirúrgicos)
    console.warn('[createTeam] req.body =', JSON.stringify(req.body));
    console.warn('[createTeam] req.user =', JSON.stringify(req.user));

    // 🔐 Entitlements do plano atual da organização
    const { entitlements, features, maxTeams } = resolveTeamEntitlements(req);

    // FREE (ou qualquer plano sem feature de equipes) -> NÃO PODE CRIAR NEM USAR
    if (!features.teams) {
      console.warn(
        '[createTeam] Bloqueado por plano: recurso de equipes desativado',
        entitlements.plan
      );
      return res.status(403).json({
        message: 'Seu plano atual não permite utilizar equipes.',
        code: 'TEAMS_FEATURE_DISABLED',
      });
    }

    // Planos com limite de equipes (ex.: plano 1, 2, 3, 4 etc.)
    // Aqui o maxTeams vem de entitlements.limits.teamsPerOrg
    if (maxTeams !== null) {
      const currentCount = await Team.countDocuments({ org: req.orgId });

      // 🔸 Isso já considera equipes criadas no trial:
      // se o usuário tinha 5 times no trial e agora está no plano 1 (maxTeams=1),
      // currentCount será 5 e a criação será bloqueada.
      if (currentCount >= maxTeams) {
        console.warn('[createTeam] Limite de equipes atingido', {
          plan: entitlements.plan,
          maxTeams,
          currentCount,
        });
        return res.status(422).json({
          message: 'Limite de equipes do seu plano foi atingido.',
          code: 'TEAMS_LIMIT_REACHED',
          details: { maxTeams, currentCount },
        });
      }
    }

    const { name, members, createdBy: bodyCreatedBy } = req.body;

    // 👇 Resolve createdBy a partir do body ou do usuário autenticado
    const createdBy =
      bodyCreatedBy || (req.user && (req.user._id || req.user.id));

    if (!createdBy) {
      console.warn(
        '[createTeam] Falha: createdBy ausente (body e req.user não forneceram ID)'
      );
      return res
        .status(400)
        .json({ message: 'Erro ao criar time: createdBy é obrigatório' });
    }

    const validatedMembers = (members || []).filter(
      (m) => m.user && m.bandRole
    );

    const uniqueMembers = validatedMembers.filter(
      (member, index, self) =>
        index ===
        self.findIndex(
          (m) =>
            m.user.toString() === member.user.toString() &&
            m.bandRole.toString() === member.bandRole.toString()
        )
    );

    const team = new Team({
      org: req.orgId,
      name,
      members: uniqueMembers,
      createdBy, // ✅ inclui createdBy no documento
    });

    await team.save();
    res.status(201).json(team);
  } catch (error) {
    console.error('Erro ao criar time:', error);
    res.status(500).json({ message: 'Erro ao criar time' });
  }
};

const updateTeam = async (req, res) => {
  try {
    const { entitlements, features, maxTeams } = resolveTeamEntitlements(req);

    // FREE (ou plano sem feature de equipes) -> não pode editar
    if (!features.teams) {
      console.warn(
        '[updateTeam] Bloqueado por plano: recurso de equipes desativado',
        entitlements.plan
      );
      return res.status(403).json({
        message: 'Seu plano atual não permite utilizar equipes.',
        code: 'TEAMS_FEATURE_DISABLED',
      });
    }

    const { name, members } = req.body;
    const team = await Team.findOne({ _id: req.params.id, org: req.orgId });

    if (!team) {
      return res.status(404).json({ message: 'Time não encontrado' });
    }

    // Se houver limite de equipes (ex.: plano 1), impede edição de equipes acima do teto
    if (maxTeams !== null) {
      const orderedIds = await Team.find({ org: req.orgId })
        .sort({ createdAt: 1, _id: 1 })
        .select('_id')
        .lean();

      const idx = orderedIds.findIndex(
        (t) => String(t._id) === String(team._id)
      );

      if (idx !== -1 && idx >= maxTeams) {
        console.warn(
          '[updateTeam] Edição bloqueada: equipe acima do limite do plano',
          { plan: entitlements.plan, maxTeams, idx }
        );
        return res.status(403).json({
          message: 'Seu plano atual não permite editar esta equipe.',
          code: 'TEAM_LOCKED_BY_PLAN',
        });
      }
    }

    const validatedMembers = members.filter(
      (m) => m.user && m.bandRole
    );

    const uniqueMembers = validatedMembers.filter(
      (member, index, self) =>
        index === self.findIndex(
          (m) =>
            m.user.toString() === member.user.toString() &&
            m.bandRole.toString() === member.bandRole.toString()
        )
    );

    team.name = name;
    team.members = uniqueMembers;
    await team.save();

    res.json(team);
  } catch (error) {
    console.error('Erro ao atualizar time:', error);
    res.status(500).json({ message: 'Erro ao atualizar time' });
  }
};

const deleteTeam = async (req, res) => {
  try {
    const { entitlements, features } = resolveTeamEntitlements(req);

    // FREE (ou plano sem feature de equipes) -> não pode usar/deletar
    if (!features.teams) {
      console.warn(
        '[deleteTeam] Bloqueado por plano: recurso de equipes desativado',
        entitlements.plan
      );
      return res.status(403).json({
        message: 'Seu plano atual não permite utilizar equipes.',
        code: 'TEAMS_FEATURE_DISABLED',
      });
    }

    const team = await Team.findOneAndDelete({ _id: req.params.id, org: req.orgId });

    if (!team) {
      return res.status(404).json({ message: 'Time não encontrado' });
    }

    res.json({ message: 'Time excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir time:', error);
    res.status(500).json({ message: 'Erro ao excluir time' });
  }
};

const getTeams = async (req, res) => {
  try {
    const { entitlements, features, maxTeams } = resolveTeamEntitlements(req);

    // FREE (ou plano sem feature de equipes) -> não vê equipes
    if (!features.teams) {
      console.warn(
        '[getTeams] Plano sem acesso a equipes, retornando lista vazia',
        entitlements.plan
      );
      return res.json([]);
    }

    const rawTeams = await Team.find({ org: req.orgId })
      .sort({ createdAt: 1, _id: 1 })
      .populate('members.user')
      .populate('members.bandRole');

    if (maxTeams === null) {
      return res.json(rawTeams);
    }

    const teams = rawTeams.map((teamDoc, index) => {
      const obj = teamDoc.toObject ? teamDoc.toObject() : teamDoc;
      return {
        ...obj,
        lockedByPlan: index >= maxTeams,
      };
    });

    res.json(teams);
  } catch (error) {
    console.error('Erro ao buscar times:', error);
    res.status(500).json({ message: 'Erro ao buscar times' });
  }
};

const getTeamById = async (req, res) => {
  try {
    const { entitlements, features, maxTeams } = resolveTeamEntitlements(req);

    // FREE não usa equipes -> responde como se não existisse
    if (!features.teams) {
      console.warn(
        '[getTeamById] Plano sem acesso a equipes, ocultando time',
        entitlements.plan
      );
      return res.status(404).json({ message: 'Time não encontrado' });
    }

    const team = await Team.findOne({ _id: req.params.id, org: req.orgId }).populate('members.user').populate('members.bandRole');

    if (!team) {
      return res.status(404).json({ message: 'Time não encontrado' });
    }

    if (maxTeams !== null) {
      const orderedIds = await Team.find({ org: req.orgId })
        .sort({ createdAt: 1, _id: 1 })
        .select('_id')
        .lean();

      const idx = orderedIds.findIndex(
        (t) => String(t._id) === String(team._id)
      );

      if (idx !== -1 && idx >= maxTeams) {
        console.warn(
          '[getTeamById] Acesso bloqueado a equipe acima do limite do plano',
          { plan: entitlements.plan, maxTeams, idx }
        );
        return res.status(403).json({
          message: 'Seu plano atual não permite utilizar esta equipe.',
          code: 'TEAM_LOCKED_BY_PLAN',
        });
      }
    }

    res.json(team);
  } catch (error) {
    console.error('Erro ao buscar time:', error);
    res.status(500).json({ message: 'Erro ao buscar time' });
  }
};

module.exports = {
  createTeam,
  updateTeam,
  deleteTeam,
  getTeams,
  getTeamById,
};
