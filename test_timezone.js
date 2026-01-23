
const istToUTC = (istDateString) => {
  if (!istDateString) return null;

  // 1. Create a Date object from the string (parses in server local time)
  const d = new Date(istDateString);
  
  // 2. Extract "Face Value" components (e.g. 12:50) regardless of timezone
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  
  console.log(`Input: ${istDateString}`);
  console.log(`Parsed Local: ${d.toString()}`);
  console.log(`Components (Face Value): ${year}-${month+1}-${day} ${hours}:${minutes}:${seconds}`);

  // 3. Create a UTC timestamp from these components (Treating 12:50 as 12:50 UTC initially)
  const asUTC = Date.UTC(year, month, day, hours, minutes, seconds);

  // 4. Subtract 5.5 hours (IST offset) to get the correct absolute UTC time
  // Example: 12:50 IST -> 12:50 UTC (base) - 5.5h = 07:20 UTC (correct)
  return new Date(asUTC - (5.5 * 60 * 60 * 1000));
};

// TEST CASES
const t1 = "2026-01-23 12:50:00"; // Should be ~07:20 UTC
const r1 = istToUTC(t1);
console.log(`Result 1 (UTC String): ${r1.toUTCString()}`);
console.log(`Result 1 (ISO String): ${r1.toISOString()}`);

if (r1.getUTCHours() === 7 && r1.getUTCMinutes() === 20) { 
    console.log("TEST 1 PASSED: 12:50 IST -> 07:20 UTC");
} else {
    console.log("TEST 1 FAILED");
}
