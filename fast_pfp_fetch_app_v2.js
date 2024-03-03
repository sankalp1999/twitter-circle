const fs = require('fs');
const puppeteer = require('puppeteer');

const getAvatar = async (twitterUsername, browser) => {
  let attempts = 2; // Number of attempts: initial + 1 retry

  for (let i = 0; i < attempts; i++) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36');
    try {
      await page.goto(`https://twitter.com/${twitterUsername}/photo`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('img[alt="Image"][draggable="true"]', { timeout: 10000 });
      const imageSrc = await page.evaluate(() => {
        const image = document.querySelector('img[alt="Image"][draggable="true"]');
        return image ? image.src : null;
      });

      console.log(`${twitterUsername}: ${imageSrc}`);
      return {twitterUsername: twitterUsername, imageSrc}; // Return successfully on first try or retry
    } catch (error) {
      console.error(`Attempt ${i + 1} failed for ${twitterUsername}: ${error.message}`);
      if (i === attempts - 1) { // If it's the last attempt, return null src
        return {twitterUsername: twitterUsername, imageSrc: null}; // Return null src on final failure
      }
      // Otherwise, it will retry
    } finally {
      await page.close();
    }
  }
};


const chunkArray = (array, size) => {
  const chunkedArr = [];
  for (let i = 0; i < array.length; i += size) {
    chunkedArr.push(array.slice(i, i + size));
  }
  return chunkedArr;
};


const processChunk = async (chunk, browser) => {
    return await Promise.all(chunk.map(([username]) => getAvatar(username, browser)));
  };

const filePath = 'mentionsCountWeighted.json';

(async () => {
    try {
      const jsonString = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(jsonString);
      const entries = Object.entries(data).slice(0, 200); // Adjust as needed
      const chunks = chunkArray(entries, 50); // Create chunks of up to 100 entries
      let results = [];
  
      for (const chunk of chunks) {
        console.log(`Processing a chunk of ${chunk.length} entries...`);
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const chunkResults = await processChunk(chunk, browser);
        results = results.concat(chunkResults);
        await browser.close(); // Close the browser after each chunk is processed
      }
  
      const resultsJson = JSON.stringify(results, null, 2);
      fs.writeFileSync('pfp_dict.json', resultsJson, 'utf8');
      console.log("Successfully saved profile images data to file.");
    } catch (err) {
      console.error("Error:", err);
    }
  })();
