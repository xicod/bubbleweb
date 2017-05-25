/*
 * Author: Denis Tokarev (denistok || xicod.com)
 *
 */

var config = {};

var browseHistory = [];
var browseHistoryIdx = 0;
var browseTopOffsets = [];

var pageCache = new Map();

var currentPlayingMediaId = "";
var currentPlayingMediaObject = undefined;

var audioPlayerId = "songStream";
var audioPlayerInitialElem = undefined;

var currentPageDetails = undefined;

function onLoadFunc(){

	$(window).resize(setListsSizes);
	setListsSizes();

	getDevices();

	if ($('#bitrateSelector option[value="' + config.defaultBitrate.toString() + '"]').length > 0){
		$('#bitrateSelector').val(config.defaultBitrate.toString());
	}

	$('#seekableTracksCheckbox').prop('checked', config.seekableTracksEnabled);

	// sortable playlist
	$('#playListItems').sortable();
	$('#playListItems').disableSelection();

	bitrateSelectorChanged($('#bitrateSelector'));

	registerAudioPlayerEvents();

	audioPlayerInitialElem = $('#' + audioPlayerId).clone(true);

	registerFullscreenActionKeys();	
}

function registerFullscreenActionKeys(){
	$(window).keydown(function(e){

		if ( $('#fullScreenOverlay').css('display') == "none"){
			return;
		}

		switch (e.keyCode) { 
			case 37: // left
				if ( $('#overlayPreviousButton').css('display') != "none" ){
					$('#overlayPreviousButton').trigger('click');
				}
				break;
			case 39: // right
				if ( $('#overlayNextButton').css('display') != "none" ){
					$('#overlayNextButton').trigger('click');
				}
				break;
			case 27: // esc
				$('#overlayCloseButton').trigger('click');
				break;
		}
	
		e.preventDefault();
	});
}

function showHideAudioPlayerError(show, msg){
	var elem = $('#songErrorLabel');
	if (show){
		elem.css('display', 'block');
		elem.text(msg);
		elem.prop('title', msg);
		showHideSongLoadingLabel(false);
	}else{
		elem.css('display', 'none');
	}
}

function registerAudioPlayerEvents(){
	document.getElementById(audioPlayerId).addEventListener('error', function (e) {
		switch (e.target.error.code) {
			case e.target.error.MEDIA_ERR_ABORTED:
				showHideAudioPlayerError(true, 'You aborted the stream playback.');
				break;
			case e.target.error.MEDIA_ERR_NETWORK:
				showHideAudioPlayerError(true, 'A network error caused the stream download to fail.');
				break;
			case e.target.error.MEDIA_ERR_DECODE:
				showHideAudioPlayerError(true, 'The stream playback was aborted due to a corruption problem or because it used features your browser did not support.');
				break;
			case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
				showHideAudioPlayerError(true, 'The stream cannot be loaded, either because the server or network failed or because the format is not supported.');
				break;
			default:
				showHideAudioPlayerError(true, 'An unknown error occurred.');
				break;
		}
	}, true);
}

function setListsSizes(){
	var minHeight = 600;

	var listNeighborElemsHeight = $('.list-toolbar').height() + 100;
	var rowHeightDest = $('body').height() - $('#topRow').height();
	var height = rowHeightDest - listNeighborElemsHeight;

	if (minHeight > rowHeightDest){
		height = minHeight - listNeighborElemsHeight;
	}

	$('#listItems').height(height);
	$('#playListItems').height(height);
}

function getDevices(){

	$('#deviceList').html("loading..");

	var queryData = {
			"action": "getdevicelist"
			};

	makeQuery(queryData, 
		function(body){
			handleDeviceList(JSON.parse(body).devices);
		},
		function(){
			$('#deviceList').html("error loading");	
		});
}

function handleDeviceList (devices){
	$('#deviceList').empty();
	for (var i=0 ; i<devices.length ; i++){
		$('#deviceList').append(getDeviceEntryHTML(devices[i]));
	}				
}

function switchToDevice(server){
	browseDevice(server.udn, 0, true);
	$('#serverNameInBrowserTab').text('(' + server.friendlyName + ')');
}

function getDeviceEntryHTML(server){
	return "<a class='list-group-item' role='button' onClick='switchToDevice(" + JSON.stringify(server) + ")'>" + server.friendlyName + "</a>";
}

function getCompleteCoverLink (coverLink, size){
	return (coverLink != "")
		? coverLink + "?w=" + size
		: "images/nocover.jpg";	
}

function getBrowserEntry(title, udn, objectId, coverLink){

	return $('<a>', {
		"role": 'button',
		"class": 'list-group-item deviceListsEntry v-align',
		// have to use onClick html property, because "click" event 
		// is being cleared when removing from page
		"onClick": "browseDevice('" + udn + "', '" + objectId + "', true)"
	}).append($('<img>', {
		"width": 48,
		"src": getCompleteCoverLink(coverLink, 48)
	})).append("&nbsp;&nbsp;" + title);
}

function makeQuery (queryData, handleFunction, failFunction){
	$.get("get.php",
		queryData,
		function (data,status){
			if (status == "success"){
				var json = JSON.parse(data);
				if (json.status == "success"){
					handleFunction(json.data.body);		
				}else{
					showError(json.errorMsg);
					if (config.debugMsgs) console.error(json.errorMsg);
					failFunction();
				}
			}else{
				showError("Error with query: " + queryData);
				if (config.debugMsgs) console.error("Error with query: " + queryData);
				failFunction();
			}
		}
	);
}

function updateBackButton(udn, objectId){
	if (objectId == 0){
		browseHistoryIdx = 0;
	}

	if (browseHistoryIdx == 0){
		$("#browseBackLink").attr("onclick","");	
	}else{
		$("#browseBackLink").attr("onclick","browseBack('" + udn 
								+ "', '" + browseHistory[browseHistoryIdx-1] 
								+ "', '" + browseTopOffsets[browseHistoryIdx-1]
								+ "')");
	}

	browseHistory[browseHistoryIdx++] = objectId;
}

function browseBack(udn, objectId, scrollOffset){
	browseHistoryIdx -= 2;
	browseDevice(udn, objectId, false);
	$('#listItems').scrollTop(scrollOffset);
}

function getCurrentBitrateSelection(){
	return $('#bitrateSelector').val();
}

function getStreamLink (baseUrl, originalSongBitrate){
	return ( getCurrentBitrateSelection() == 0 || getCurrentBitrateSelection() >= originalSongBitrate)
		? baseUrl
		: (baseUrl + "?bitrate=" + getCurrentBitrateSelection() + (($('#seekableTracksCheckbox').is(':checked')) ? "&seekable" : ""));
}

function resetAudioPlayerToDefault(){
	$('#songDetailsArtist').text('');
	$('#songDetailsTitle').text('');
	$('#songDetailsDuration').text('');
	$('#songDetailsAlbum').text('');
	$('#songDetailsBitrate').text('');
	$("#coverImage").attr("src", getCompleteCoverLink('', 160)); 

	var audioElemSrc = $('#' + audioPlayerId).attr('src');
	if (audioElemSrc != undefined && audioElemSrc != ''){
		var volume = $('#' + audioPlayerId).prop('volume');
		$('#audioPlayerWrapper').empty();
		$('#audioPlayerWrapper').append(audioPlayerInitialElem.clone(true));
		$('#' + audioPlayerId).prop('volume', volume);
		if (config.debugMsgs) console.info('replaced audio elem');
	}
}

function playSong (media){

	currentPlayingMediaId = media.id;
	currentPlayingMediaObject = media;

	closeOverlay();

	setStatusOnActiveSong();

	var originalBitrate = Number(media.audio.originalBitrate);

	$('#songDetailsArtist').text(media.audio.artist);
	$('#songDetailsTitle').text(media.title);
	$('#songDetailsAlbum').text(media.audio.album);
	$('#songDetailsBitrate').text( originalBitrate + "kbps" 
		+ (
			(getCurrentBitrateSelection() != 0 && getCurrentBitrateSelection() < originalBitrate) ? " (Compressed to " + getCurrentBitrateSelection() + "kbps)" : ""
		) 
	);
	$('#songDetailsDuration').text('(' + media.audio.duration + ')');
	$("#coverImage").attr("src", getCompleteCoverLink(media.coverLink, 160));

	showHideSongLoadingLabel(true);

	loadSongInPlayer(getStreamLink(media.streamLink, originalBitrate));
}

function loadSongInPlayer(url){
	if (config.debugMsgs) console.info("Playing: " + url);

	var elem = document.getElementById(audioPlayerId);
	elem.src = url;
	elem.load();
}

function onPlayerCanPlay(){
	var elem = document.getElementById(audioPlayerId);
	elem.play();
}

function clearPlaylist(){
	$('#playListItems').empty();
}

function addToPlaylist (media){
	media.id = Math.random().toString(36).substr(2, 8);
	var elem = getMediaEntry(media, "playlist");
	$('#playListItems').append(elem);
}

function getPlaylistMediaEntry(id){
	var res = $('#playListItems').find('div').filter(function(){return $(this).text() === id});
	if (res.length == 0) {
		return undefined;
	}else{
		return res.parent();
	}
}

function removeFromPlaylist(id){
	getPlaylistMediaEntry(id).remove();
}

function getMediaEntry(media, mode){

	var clickable = $('<a>', {
		"class": 'list-group-item deviceListsEntry v-align col-xs-' + (mode == "playlist" ? '10' : '11') + ' mediaItemClickable',
		"role": 'button',
		"onClick": "playMedia(" + JSON.stringify(media) + ")"
	}).append($('<img>', {
                "width": 48,
                "src": getCompleteCoverLink(media.coverLink, 48)
        })).append("<span style='margin-left: 10px'>" 
			+ ((media.type == "audio" && media.audio.trackNumber != undefined ? media.audio.trackNumber + ". " : "") + media.title)
			+ "&nbsp;&nbsp;<img class='playStatus' width='16'></span>");

	return $('<div>', { "class": 'v-align' }).append(
		$('<div>', { "class": 'songId', "style": 'display: none;', "text": media.id })
	).append(
		clickable
	).append(
		(mode == "browser")
		? $('<a>', { 
			"role": 'button', 
			"class": 'col-xs-1 mediaItemAddToPlaylist',
			"onClick": "addToPlaylist(" + JSON.stringify(media) + ")"
		}).append(
			$('<img>', { "src": 'images/plus.png', "width": '32' })
		)
		: (mode == "playlist")
			? $('<a>', { 
				"role": 'button', 
				"class": 'col-xs-1 mediaItemRemoveFromPlaylist',
				"onClick": "removeFromPlaylist('" + media.id + "')"
				}).append(
					$('<img>', { "src": 'images/minus.png', "width": '32' })
				)
			: "None"
	).append(
		(mode == "playlist")
		? $('<a>', { 
			"role": 'button', 
			"class": 'col-xs-1 mediaItemDragger'
			}).append(
				$('<img>', { "src": 'images/drag.png', "width": '32' })
			)
		: ""

	);
}

function browseQuery (udn, objectId){
	var queryData = {
			"action": "browseByObjectId",
			"serverId": udn,
			"objectId": objectId
			}
			
	makeQuery(queryData, 
	function(body){
		var urlParams = new URLSearchParams(body);
		var xmlStr = urlParams.get('Result');

		if (config.debugMsgs) console.info(xmlStr);
		
		var entries = Array();

		var xml = $.parseXML(xmlStr),$xml = $(xml),$test = $xml.find('container').each(function(index,elem){
			entries.push(handleBrowserXmlEntryContainer(elem, udn, objectId));
		});
	
		var xml = $.parseXML(xmlStr),$xml = $(xml),$test = $xml.find('item').each(function(index,elem){
			entries.push(handleBrowserXmlEntryMedia(elem));
		});

		pageCache.set(udn+objectId, entries);
		displayBrowseEntries(udn+objectId);
	},
	function(){
	});
}

function handleBrowserXmlEntryContainer (elem, udn, objectId){
	var objectId= $(elem).attr('id');
	var title = "";
	var coverLink = "";

	var children = $(elem).children();
	for (var i=0 ; i<children.length ; i++){
		var prop = children[i];
		if (prop.tagName == "dc:title"){	
			title = $(prop).text();
		} else if (prop.tagName == "upnp:albumArtURI" && coverLink == ""){
			coverLink = $(prop).text();
		}

	}

	return getBrowserEntry(title, udn, objectId, coverLink);
}

function handleBrowserXmlEntryMedia (elem){
	
	var media = {	id: $(elem).attr('id'),
			type: '',
			title: '',
			coverLink: '',
			streamLink: '',
			
			audio: {}, image: {}, video: {}
	};

	var children = $(elem).children();
	for (var i=0 ; i<children.length ; i++){
		var prop = children[i];
		if (prop.tagName == "upnp:artist"){
			media.audio.artist = $(prop).text();
		} else if (prop.tagName == "dc:title"){	
			media.title = $(prop).text();
		} else if (prop.tagName == "upnp:album"){
			media.audio.album = $(prop).text();
		} else if (prop.tagName == "upnp:originalTrackNumber"){
			media.audio.trackNumber = $(prop).text();
		} else if (prop.tagName == "upnp:albumArtURI" && media.coverLink == ""){
			media.coverLink = $(prop).text();
		} else if (prop.tagName == "res" && media.streamLink == ""){
			var mediaType = $(prop).attr('protocolInfo').split(':')[2];
			media.type = mediaType.substring(0, mediaType.indexOf('/'));

			if (media.type == 'audio'){
				media.audio.originalBitrate = $(prop).attr('bitrate');
			}

			if (media.type == 'audio' || media.type == 'video' ){
				media.audio.duration = $(prop).attr('duration').replace(/^0:/, "").replace(/\.000$/, "");
			}

			media.streamLink = $(prop).text();
		}
	}

	if (media.audio.originalBitrate > 0){
		media.audio.originalBitrate /= 125;
	}

	return getMediaEntry(media, "browser");
}

function refreshPage(){
	if (currentPageDetails == undefined) return;

	pageCache.delete(currentPageDetails.udn + currentPageDetails.objectId);
	browseDevice(currentPageDetails.udn, currentPageDetails.objectId, false);
}

function browseDevice(udn, objectId, doPreviousScrollOffsetUpdate){
	if (config.debugMsgs) console.info("Browsing device with udn = " + udn + " and objectId=" + objectId);

	if (doPreviousScrollOffsetUpdate && browseHistoryIdx > 0){
		browseTopOffsets[browseHistoryIdx-1] = $('#listItems').scrollTop();
	}

	if (currentPageDetails == undefined || currentPageDetails.udn != udn || currentPageDetails.objectId != objectId){
		currentPageDetails = {udn: udn, objectId: objectId};
		updateBackButton(udn, objectId);
	}


	$('#browseFilter').val('');
	browseFilterChanged();
	
	if (!pageCache.has(udn+objectId)){
		if (config.debugMsgs) console.info("cache not populated, loading from server");
		$('#listItems').empty();
		$('#listItems').html('&nbsp;&nbsp;Loading..');
		browseQuery(udn, objectId);		
	}else{
		if (config.debugMsgs) console.info("loading page from cache");
		displayBrowseEntries(udn+objectId);
	}

	setStatusOnActiveSong();

	$('#listItems').scrollTop(0);

	$('#browseFilter').focus();
}

function displayBrowseEntries (pageKey){
	$('#listItems').empty();
	
	var elemArr = pageCache.get(pageKey);

	for (var i=0 ; i<elemArr.length ; i++){
		$('#listItems').append($(elemArr[i]));
	}
}


function showError(msg){
	$('#errorMsg').html(msg);
	document.getElementById('errorBox').style.display = 'block';

	window.setTimeout ( function() {
				 document.getElementById('errorBox').style.display = 'none'; 
				}, 3000);
}


function browseFilterChanged(){
	var newVal = $('#browseFilter').val();

	$('#listItems').children().each(function(index, elem){
		if ($(elem).text() == "" || $(elem).text().toLowerCase().indexOf(newVal.toLowerCase()) != -1){
			$(elem).attr('style', 'display: ;');
		}else{
			$(elem).attr('style', 'display: none;');
		}
	});
}

function playerEndedPlayback(){
	var currPlaylistItem = getPlaylistMediaEntry(currentPlayingMediaId);

	if (currPlaylistItem != undefined){
		var nextPlayListItem = currPlaylistItem.next();
		if (nextPlayListItem != undefined){
			$(nextPlayListItem).find('a.mediaItemClickable').trigger('click');
			goToCurrentTrack();
		}
	}else{
		var playlistItems = $('#playListItems').children();
		if (playlistItems.length > 0){
			$(playlistItems[0]).find('a.mediaItemClickable').trigger('click');
			goToCurrentTrack();
		}
	}
}

function playerPlaying(){
	setStatusOnActiveSong();
	showHideSongLoadingLabel(false);
	showHideAudioPlayerError(false, "");
}

function setStatusOnActiveSong(){

	var paused = document.getElementById(audioPlayerId).paused;

	$('#playListItems, #listItems').children().each(function(index, elem){
		var statusContainer = $(elem).find('img.playStatus');
		if ($(elem).find('div.songId').text() == currentPlayingMediaId){
			statusContainer.attr("src", "images/" + ((paused) ? "pause.png" : "play.png"));
			statusContainer.attr("style", "display: ;");
		}else{
			statusContainer.attr("style", "display: none;");
		}
	});
}

function playerPaused(){
	setStatusOnActiveSong();
}

function addAllSongsToPlaylist(){
	$('#listItems').find('a.mediaItemAddToPlaylist').trigger('click');
}

function goToCurrentTrack(){
	var entry = getPlaylistMediaEntry(currentPlayingMediaId);

	if (entry === undefined){
		return;
	}

	$('#playListItems').animate({scrollTop: ($('#playListItems').scrollTop() + $(entry).position().top - 200)}, 500);
}

function bitrateSelectorChanged(){
	
	if (getCurrentBitrateSelection() == 0){
		$('#seekableTracksCheckbox').prop('checked', false);
		$('#seekableTracksCheckbox').prop('disabled', true);
	}else{
		$('#seekableTracksCheckbox').prop('disabled', false);
	}

	if (currentPlayingMediaObject != undefined && currentPlayingMediaObject.type == "audio"){
		playSong(currentPlayingMediaObject);
	}
}


function showHideSongLoadingLabel (show) {
	if (show){
		$('#songLoadingLabel').attr('style', 'display:;');
	}else{
		$('#songLoadingLabel').attr('style', 'display: none;');
	}
}

function shuffleArray (arr){
	for (var i = arr.length; i; i--) {
		var rand = Math.floor(Math.random() * i);
		var tmp = arr[i - 1];
		arr[i - 1] = arr[rand];
		arr[rand] = tmp;
	}
}

function shufflePlaylist(){
	var playlistElems = $('#playListItems').children();
	
	shuffleArray(playlistElems);

	$('#playListItems').empty();

	for (var i=0 ; i<playlistElems.length ; i++){
                $('#playListItems').append($(playlistElems[i]));
        }

	goToCurrentTrack();
}

function playMedia (media){
	if (media.type == "audio"){
		playSong(media);
	} else if (media.type == "image" || media.type == "video"){
		playInOverlay(media);
	}
}

function playInOverlay (media){

	currentPlayingMediaId = media.id;
	currentPlayingMediaObject = media;	

	document.getElementById("songStream").pause();

	// as much as the playlist concerned, images and videos always "paused"
	// when overlay showing
	setStatusOnActiveSong();

	resetAudioPlayerToDefault();

	if ( $('#fullScreenOverlay').css('display') == 'none'){
		$('#fullScreenOverlay').css('display', 'block');

		$('#overlayHint').css('display', 'block');
		setTimeout(function(){ 
			$('#overlayHint').css('display', 'none');
		}, 5000);
	}

	$('#overlayMedia').empty();
	
	var mediaObject = undefined;

	if (media.type == "image"){
		mediaObject = $('<img>', {
				"id": 'overlayMediaObject',
				"src": media.streamLink
		});
	} else if (media.type == "video"){
		mediaObject = $('<video>', {
				"id": 'overlayMediaObject',
				"controls": 'controls',
				"autoplay": 'autoplay',
				"src": media.streamLink,
				"onEnded": 'playerEndedPlayback()'
		});
	}

	$('#overlayMedia').append(mediaObject);

	var currPlaylistItem = getPlaylistMediaEntry(currentPlayingMediaId);

	$('#overlayNextButton, #overlayPreviousButton').attr('style', 'display: none;');

	if (currPlaylistItem != undefined){
		var nextPlayListItem = currPlaylistItem.next();
		if (nextPlayListItem.length != 0){
			$('#overlayNextButton').attr('onClick', 
							$(nextPlayListItem).find('a.mediaItemClickable').attr('onClick') + "; goToCurrentTrack()");
			$('#overlayNextButton').attr('style', 'display: block;');
		}

		var prevPlayListItem = currPlaylistItem.prev();
		if (prevPlayListItem.length != 0){
			$('#overlayPreviousButton').attr('onClick', 
							$(prevPlayListItem).find('a.mediaItemClickable').attr('onClick') + "; goToCurrentTrack()");
			$('#overlayPreviousButton').attr('style', 'display: block;');
		}
	}

}

function closeOverlay(){
	$('#overlayMedia').empty();
	$('#fullScreenOverlay').attr('style', 'display: none;');
}
