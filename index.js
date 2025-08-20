const express = require('express');
const bodyParser = require('body-parser');
const { parseString } = require('xml2js');
const fetch = require('node-fetch');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const CALLBACK_URL = process.env.CALLBACK_URL;
const PORT = process.env.PORT || 3000;

if (!DISCORD_WEBHOOK_URL || !YOUTUBE_CHANNEL_ID || !CALLBACK_URL) {
  console.error('❌ خطأ فادح: واحد أو أكثر من المتغيرات السرية (Secrets) غير موجود. يرجى مراجعة الإعدادات.');
  process.exit(1); 
}

const app = express();

app.use(bodyParser.raw({ type: 'application/atom+xml' }));

app.get('/', (req, res) => {
  const hubChallenge = req.query['hub.challenge'];
  if (hubChallenge) {
    console.log('✅ تم التحقق من الاشتراك بنجاح من قبل يوتيوب!');
    res.status(200).send(hubChallenge);
  } else {
    res.status(400).send('Bad Request');
  }
});

app.post('/', (req, res) => {
  console.log('📬 تم استلام إشعار جديد من يوتيوب!');
  parseString(req.body, async (err, result) => {
    if (err) {
      console.error('❌ خطأ في تحليل XML:', err);
      return res.status(500).end();
    }

    if (!result.feed.entry) {
      console.log('ℹ️ تم استلام إشعار تحديث (وليس فيديو جديد)، سيتم تجاهله.');
      return res.status(204).end();
    }

    const entry = result.feed.entry[0];
    if (entry && entry['yt:videoId']) {
      const videoId = entry['yt:videoId'][0];
      const videoTitle = entry.title[0];
      const channelName = entry.author[0].name[0];
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const channelUrl = `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`;

      console.log(`✅ فيديو جديد تم العثور عليه: ${videoTitle}`);

      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      const embed = {
        color: 0xff0000, 
        title: videoTitle,
        url: videoUrl,
        author: {
          name: channelName,
          url: channelUrl
        },
        image: {
          url: thumbnailUrl, 
        },
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Powered By Nuix',
        },
      };

      const payload = {
        username: `${channelName}`,
        avatar_url: 'https://ik.imagekit.io/bv3ndotua/Mortada%20Radawy.png?updatedAt=1755579958618',
        content: `${channelName} نشر مقطع جديد 🔥\n @everyone`,
        embeds: [embed],
        components: [
          {
            type: 1, 
            components: [
              {
                type: 2, 
                style: 5, 
                label: 'مشاهدة الفيديو',
                url: videoUrl,
              },
              {
                type: 2, 
                style: 5, 
                label: 'اشترك بالقناة',
                url: `${channelUrl}?sub_confirmation=1`,
              },
            ],
          },
        ],
        allowed_mentions: {
            parse: ["everyone"]
        }
      };

      try {
        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log('✉️ تم إرسال الإشعار عبر الويب هوك بنجاح!');
      } catch (error) {
        console.error('❌ فشل إرسال رسالة الويب هوك:', error);
      }
    }
    res.status(204).end();
  });
});

async function subscribeToYoutube() {
  console.log('🔄 جاري محاولة الاشتراك في إشعارات يوتيوب...');
  const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
  const hubUrl = 'https://pubsubhubbub.appspot.com/';

  const response = await fetch(hubUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.topic': topicUrl,
      'hub.callback': CALLBACK_URL,
      'hub.verify': 'async'
    }).toString(),
  });

  if (response.ok) {
    console.log('✅ تم إرسال طلب الاشتراك بنجاح. انتظر رسالة التحقق.');
  } else {
    console.error('❌ فشل إرسال طلب الاشتراك:', await response.text());
  }
}


app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  subscribeToYoutube();
  setInterval(subscribeToYoutube, 5 * 24 * 60 * 60 * 1000); 
});
