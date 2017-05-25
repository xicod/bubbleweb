<?php

$_CONFIG['srv_username'] = "YOUR_BUBBLESERVER_USERNAME";
$_CONFIG['srv_password'] = "YOUR_BUBBLESERVER_PASSWORD";

// When setting BubbleUPnP server url, consider that the client will be trying to pull
// media from there. If there is no valid certificate for https, it will complain.
// So in this case, the url below should probably point to a proxy with valid SSL certificate.
$_CONFIG['bubbleServerUrl'] = 'https://host:PORT'

?>
