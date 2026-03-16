const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/banks/cash-at-bank-report',
  method: 'GET'
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);

  let data = '';
  res.on('data', d => {
    data += d;
  });

  res.on('end', () => {
     try {
         const json = JSON.parse(data);
         console.log("Total: ", json.total);
         console.log("Current Balance: ", json.currentBalance);
         console.log("Records length: ", json.records?.length);
         if(json.records?.length > 0) {
              console.log("First Record: ", json.records[0]);
              // Look for a record with a party name
              const withParty = json.records.find(r => r.partyName);
              if (withParty) {
                  console.log("Record with partyName found:", withParty);
              } else {
                  console.log("No record with partyName found in this page.");
              }
         }
     } catch (e) {
         console.error("Error parsing JSON:");
         console.error(data.substring(0, 500));
     }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
