const { unifiedSearch } = require('./services/musicApiService');

(async () => {
  const results = await unifiedSearch('aleluia');
  console.log(JSON.stringify(results, null, 2));
})();
