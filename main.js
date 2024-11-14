// register a webhook for any event type: use custom URL for each type of webhook event, for example channel.subscribe
// this callback needs to be wrapped in HTTPs for twitch to call it. use something like caddy to do this easily.

const twitchwebhooksecret = ""; // TODO: define a secret to pass to twitch when registering webhooks, and include it here to support validating the webhook messages.

// Notification request headers
const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp'.toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature'.toLowerCase();

const express = require('express');
const crypto = require('crypto')
const app = express();

// HMAC twitch message signing implementations

// retrieve the pieces of content used to generate the HMAC hash.
function getHmacPieces(request) { // pass in express request as parameter
    return (request.headers[TWITCH_MESSAGE_ID] + 
        request.headers[TWITCH_MESSAGE_TIMESTAMP] + 
        request.rawBody); // rawBody added from middleware: parseRawBodyForWebhooksWithHmacValidation
}

// Get the HMAC.
function getHmac(secret, message) {
    return crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

// Verify whether signature matches Twitch's signature.
function verifyMessage(hmac, verifySignature) {
    verifySignature = verifySignature.split('=')[1]
    return hmac == verifySignature;
}

// function to do all validation of message: pass in request from express
const validateRequest = function (req) {
    return true === verifyMessage(getHmac(twitchwebhooksecret, getHmacPieces(req)), req.headers[TWITCH_MESSAGE_SIGNATURE]) // compute signature and check that it matches using helper funcs
}

// express middleware function to stop using express.json for specific endpoints if they need raw post body for HMAC signature validation
// this way we have both the JSON POST data and the raw POST content to be checksummed and validated with HMAC
const parseRawBodyForWebhooksWithHmacValidation = (req, res, next) => {
  req.rawBody = '';
  req.setEncoding('utf8');

  req.on('data', function(chunk) {
    req.rawBody += chunk;
  });

  req.on('end', function() {
    try {
      req.body = {};
      if (req.rawBody.length) req.body = JSON.parse(req.rawBody)
    } catch(err) {
      console.log("Error parsing JSON request")
      console.log(err)
      console.log(req)
    }
    next();
  });
};

app.use(parseRawBodyForWebhooksWithHmacValidation); // install middleware

// implmeentation of webhook post API handler. handle multiple different types of events.
app.post('/webhook/twitch/:eventtype', async (req, res) => {
  const eventtype = req.params.eventtype;
  console.log(`${new Date().toISOString()} Incoming twitch webhook for ${eventtype}`)
  // verify the HMAC signature of the message
  if (!validateRequest(req)) {
    console.log("blocked event with invalid HMAC signature")
    return res.status(403).send("HMAC digest check failed")
  }
  if (req.body.challenge) { // handle webhook registration challenges from twitch
    await res.status(200).send(req.body.challenge);
    console.log(`reponding to registration challenge for event ${eventtype}`)
  } else {
    // some messages come with a user ID
    var userid = req.body.user_id // handle special case of global webhooks that apply for all users and contain user info within the event
    const messagetype = req.headers['twitch-eventsub-message-type']
    if (!messagetype || messagetype != 'revocation') { // handle Twitch revoking webhook subscriptions: Twitch-Eventsub-Message-Type: revocation
      // this revocation happens when a user unhooks the app from their dashboard
      console.log(`event ${eventtype} for twitch user ${userid} ${messagetype}`)
      const eventid = req.headers['twitch-eventsub-message-id']
      if (req.body.event) {
        // at this point we have a valid twitch event to push and not a handshake or webhook registration setup or revocation event
        //
        // TODO: add your code to handle, log, and store the event here
        console.log(JSON.stringify(req.body.event); // print event to console as default demonstration behavior
        //
      }
    } else {
      console.log(`revoked webhook subscription ${eventtype} for ${userid}`)
    }
    await res.status(200).send(''); // send 200 status back to twitch. the webhook will get re-called by twitch within a reasonable amount of time if this server crashes and 200 success is not received.
  }
});

// TODO: forward HTTPS to local port 3000 with an HTTP proxy host like caddy or nginx. outside the scope of this code.
// example shell command to forward with caddy: sudo caddy reverse-proxy --to :3000 --from twitchwebhooks.yourdomain.com
const port = 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
