const fs = require('fs');
const path = require('path');

function extractTwitterData(tweet_data) {
    return tweet_data.map(data => {
      // Extract user mentions
      data = data.tweet
      timestamp = data.created_at
      url_id = data.id_str
     

      let userMentions = [];
      let validUrls = [];
  
      // Check if user_mentions exists before accessing it
      if (data.entities && data.entities.user_mentions) {
        console.log("YES")
        userMentions = data.entities.user_mentions.map(mention => ({
          name: mention.name,
          screen_name: mention.screen_name,
          id: mention.id,
          id_str: mention.id_str
        }));
      }
  
      // Check if urls exist and match the criteria before accessing
      if (data.entities && data.entities.urls) {
        validUrls = data.entities.urls.filter(url => 
          url.expanded_url.match(/^https:\/\/twitter\.com\/\w+\/status\/\d+/)
        ).map(url => ({
          expanded_url: url.expanded_url
        }));
      }
  
      return {
        timestamp,
        url_id,
        userMentions,
        validUrls
      };
    });
  }

// pending, just testing some shit
function aggregateMentions(data) {
const mentionsCount = {};

data.forEach(tweet => {
    tweet.userMentions.forEach(mention => {
    const { screen_name } = mention;
    if (mentionsCount[screen_name]) {
        mentionsCount[screen_name]++;
    } else {
        mentionsCount[screen_name] = 1;
    }
    });
});

return mentionsCount;
}



// Adjust the path to the location of your file
const filePath = path.join(__dirname, 'twitter-archive/data/tweets.js');

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Attempt to isolate the JSON part and parse it
  try {
    const jsonPart = data.substring(data.indexOf('=') + 1).trim();
    const tweets = JSON.parse(jsonPart);
    console.log('Tweets loaded:', tweets.length);
    const extractedData = extractTwitterData(tweets); // assuming 'tweets' is your loaded data
 
    const filteredData = extractedData.filter(item => item.userMentions.length > 0 || item.validUrls.length > 0);
    console.log(JSON.stringify(filteredData, null, 2));
    const mentionsCount = aggregateMentions(filteredData);

    const sortedMentionsArray = Object.entries(mentionsCount).sort((a, b) => b[1] - a[1]);
    const sortedMentionsObject = Object.fromEntries(sortedMentionsArray);
    fs.writeFile('mentionsCount.json', JSON.stringify(sortedMentionsObject, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error writing file:', err);
        } else {
          console.log('Data saved successfully.');
        }
      });


  } catch (parseErr) {
    console.error('Error parsing JSON:', parseErr);
  }
});


