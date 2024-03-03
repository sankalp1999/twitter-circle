const puppeteer = require('puppeteer');

const getAvatar = async (twitterUsername) => {
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36');
  try {
  await page.goto(`https://twitter.com/${twitterUsername}/photo`);
  await page.waitForSelector('img[alt="Image"][draggable="true"]', { timeout: 10000 });
  const imageSrc = await page.evaluate(() => {
    const image = document.querySelector('img[alt="Image"][draggable="true"]');
    return image ? image.src : null;
  });

  if (imageSrc) {
    console.log(`${twitterUsername}: ${imageSrc}`);
  } else {
    console.log(`${twitterUsername}: Profile image URL not found.`);
  }
  
} catch (error) {
  console.error(`Failed to retrieve profile image for ${twitterUsername}: ${error.message}`);
} finally {
  await page.close();
  await browser.close();
}
};

const pfp_list = ['dejavucoder', 'sama', 'elonmusk', 'p_nawrot']
pfp_list.map( item => {
    getAvatar(item)
})

