<?php

class BubbleConnector {

	private $_CONFIG = null;

	function __construct($config_arr) {
		if ($config_arr == null) return;

		$this->_CONFIG = $config_arr;

		if ( ($msg = $this->checkConfig()) != null ){
			die ($this->getJSONResponse("fail", $msg, ""));
		}
	}

	private function checkConfig(){
		if (!isset($this->_CONFIG['srv_username'])){
			return "username is missing from config file";
		}

		if (!isset($this->_CONFIG['srv_password'])){
			return "password is missing from config file";
		}

		if (!isset($this->_CONFIG['bubbleServerUrl'])){
			return "Bubble server url is missing from config file";
		}

		return null;
	}

	function browseByObjectId ($serverId, $objectId){
		$url = $this->_CONFIG['bubbleServerUrl'] . "/res/dev/" . $serverId . "/svc/upnp-org/ContentDirectory/action/Browse";
		
		$postFields = Array(
				"StartingIndex" => "0",
				"SortCriteria" => "",
				"ObjectID" => $objectId,
				"Filter" => "*",
				"RequestedCount" => "0",
				"BrowseFlag" => "BrowseDirectChildren"
				);

		$curlOptions = $this->getPostCurlOptions($url, $postFields);
			
		$result = $this->makeCurlCall($curlOptions);
		
		$result = $this->replaceUrlsInResponse($result);

		return $result;
	}


	function getDeviceList (){
		$url = $this->_CONFIG['bubbleServerUrl'] . "/res/link/" . md5($_SERVER['SERVER_NAME'] . rand());
		$curlOptions = $this->getBaseCurlOptions($url);
		$result = $this->makeCurlCall($curlOptions);

		$curlOptions[CURLOPT_CUSTOMREQUEST] = 'DELETE';
		$resultDelete = $this->makeCurlCall($curlOptions);

		if (json_decode($resultDelete, true)['status'] == "fail"){
			echo $resultDelete;
		}else{
			echo $result;
		}
	}

	private function replaceUrlsInResponse($json){

		$arr = json_decode($json, true);
		
		$chunks = explode('&', $arr['data']['body']);
		foreach ($chunks as &$chunk){
			$param = explode('=', $chunk);
			if (urldecode($param[0]) == "Result"){
				$xmlStr = urldecode($param[1]);
				$replacedXmlStr = $this->replaceUrlsInXml(new SimpleXMLIterator($xmlStr), 'upnp')->asXML();
				$param[1] = urlencode($replacedXmlStr);
				$chunk = $param[0] . '=' . $param[1];
			}
		}

		$arr['data']['body'] = implode('&', $chunks);

		return json_encode($arr, true);
	}

	private function replaceUrlsInXml($xml, $ns) {
		$reg = '/^http[s]*:\/\/[^\/]*/';
		foreach($xml->children() as $child) {
			if ( count($child->children()) == 0 && count($child->children($ns, true)) == 0 ){
				$child[0] = preg_replace($reg, $this->_CONFIG['bubbleServerUrl'], $child[0]);
			}else{
				$this->replaceUrlsInXml($child, $ns);
			}
		}

		foreach($xml->children($ns, true) as $child) {
			if ( count($child->children()) == 0 && count($child->children($ns, true)) == 0 ){
				$child[0] = preg_replace($reg, $this->_CONFIG['bubbleServerUrl'], $child[0]);
			}else{
				$this->replaceUrlsInXml($child, $ns);
			}
		}

		return $xml;
	}

	private function getPostCurlOptions ($url, $postFields){
		$opts = $this->getBaseCurlOptions($url);
		$opts[CURLOPT_POST] = 'true';
		$opts[CURLOPT_POSTFIELDS] = http_build_query($postFields);

		return $opts;
	}

	private function getBaseCurlOptions($url){
		return array(
			CURLOPT_URL            => $url,
			CURLOPT_HEADER         => true,    
			CURLOPT_VERBOSE        => true,
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_FOLLOWLOCATION => true,
			CURLOPT_SSL_VERIFYPEER => false,    // for https
			CURLOPT_SSL_VERIFYHOST => false,
			CURLOPT_USERPWD        => $this->_CONFIG['srv_username'] . ":" . $this->_CONFIG['srv_password'],
			CURLOPT_HTTPAUTH       => CURLAUTH_DIGEST,
		);
	}

	private function makeCurlCall ($curlOptions){
		$ch = curl_init();
		curl_setopt_array($ch, $curlOptions);

		$error = "";
	
		try {
			$raw_response  = curl_exec($ch);

			// validate CURL status
			if(curl_errno($ch)){
				throw new Exception(curl_error($ch), 500);
			}

			// validate HTTP status code
			$status_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
			if ($status_code != 200 && $status_code != 201){
				throw new Exception("Response with Status Code [" . $status_code . "].", 500);
			}

		} catch(Exception $ex) {
			$error = $ex->getMessage();
		}

		$result = Array();

		if ($error == ""){
			$header_size = curl_getinfo($ch,CURLINFO_HEADER_SIZE);
			$result['header'] = substr($raw_response, 0, $header_size);
			$result['body'] = substr( $raw_response, $header_size );
			$result['http_code'] = curl_getinfo($ch,CURLINFO_HTTP_CODE);
			$result['last_url'] = curl_getinfo($ch,CURLINFO_EFFECTIVE_URL);

			$status = "success";
		}else{
			$status = "fail";
		}	

		if (!is_null($ch)) curl_close($ch);
		
		return $this->getJSONResponse($status, $error, $result);
	}

	function getJSONResponse ($status, $error_msg, $data){
		return json_encode(Array("status" => $status, "errorMsg" => $error_msg, "data" => $data));
	}	
}

?>

