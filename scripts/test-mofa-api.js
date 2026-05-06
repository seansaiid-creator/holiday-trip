// scripts/test-mofa-api.js
require('dotenv').config({ path: '.env.local' });

async function main() {
  const key = process.env.MOFA_API_KEY;
  const url = `http://apis.data.go.kr/1262000/TravelAlarmService2/getTravelAlarmList2?serviceKey=${key}&returnType=JSON&numOfRows=10&pageNo=1`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  const items = data?.response?.body?.items?.item || [];
  console.log('Total:', data?.response?.body?.totalCount);
  console.log('Sample items:');
  items.forEach(item => console.log(JSON.stringify(item)));
}

main().catch(console.error);