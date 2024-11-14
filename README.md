# twitch-webhook-callbacks

Fully implemented node.js backend API for receiving webhook calls from Twitch. Originally developed for a graphic design company.

Twitch EventSub Webhook Reference: https://dev.twitch.tv/docs/eventsub/handling-webhook-events/

## implementing and using

- run this program as API server to handle webhooks from Twitch EventSub API webhook API
- run HTTPs proxy server to forward HTTPs traffic to this local HTTP server
  - example shell command to forward HTTP and HTTPS ports 80 and 443 to local port 3000 with caddy:
    ```bash
    sudo caddy reverse-proxy --to :3000 --from webhooks.yourdomain.com
    ```
    - https://caddyserver.com/
- subscribe to webhooks for an event on Twitch: https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription
  - proper access required
- webhook APIs are called by Twitch when events occur. if valid response code is not received, or the server is down, Twitch will cache the message for some time and attempt to retry sending it.
