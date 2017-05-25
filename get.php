<?php

//error_reporting(E_ALL); 
//ini_set( 'display_errors','1');

require_once "BubbleConnector.lib.php";

if ( (@include_once "config.inc.php") == false){
	$bubble = new BubbleConnector(null);
	die($bubble->getJSONResponse("fail", "config.inc.php wasn't found", ""));
}

$bubble = new BubbleConnector($_CONFIG);

if ($_GET['action'] == "getdevicelist"){
	echo $bubble->getDeviceList();
}elseif ($_GET['action'] == "browseByObjectId") {
	echo $bubble->browseByObjectId($_GET['serverId'], $_GET['objectId']);
}

?>
