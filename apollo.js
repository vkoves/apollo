/* Uses JMPerez Spotify JS Wrapper https://github.com/JMPerez/spotify-web-api-js */

var spotifyApi;
var origin = "http://viktorkoves.com"; // assume on production, and set origin variable as such

if(window.location.href.indexOf("localhost") > -1) // if we're on localhost after all
	origin = "http://localhost:4000"; // likewise set the origin to reflect this

$(document).ready(function()
{
	if(window.location.href.indexOf("access_token") > -1) // if this is a redirect from Spotify authorization
	{
		var dataToPass = {"access_token": window.location.href.split("access_token=")[1].split("&")[0]}; // create a hash with the data to pass to the other window
		window.opener.postMessage(JSON.stringify(dataToPass), origin); // andd pass the data to the original window (the one that opened this one)
		window.close(); // then close this window
	}

	spotifyApi = new SpotifyWebApi(); // init SpotifyWebApi

	$("#spotify-authorize").click(function()
	{
		login(loginComplete);
	});

	$("#get-track-data").click(function()
	{
		if($(this).hasClass("disabled")) // return if the button is non active
			return;

		var trackInputData = $("#track-id").val();
		var trackId = trackInputData;

		if(trackInputData.indexOf("spotify:track:") == 0) // if URI, trim
			trackId = trackInputData.split("spotify:track:")[1];

		// Also can use getAudioFeaturesForTracks(Array<string>)
		spotifyApi.getAudioFeaturesForTrack(trackId).then(graphAudioFeatures);	
	});
});

function loginComplete(access_token)
{
	$("#spotify-authorize").addClass("disabled").text("Authorized!"); // indicate authorization worked
	$("#spotify-authorize").off(); // and disable the click event from being fired again
	$(".needs-auth").removeClass("disabled");

	spotifyApi.setAccessToken(access_token);
}

function graphAudioFeatures(featureData)
{
	console.log(featureData);
	for(key in featureData) // iterate through each feature attribute
	{
		if(key in spotifyGraphableData) // and graph if it's in the list of allowed data to graph
		{
			keyData = spotifyGraphableData[key];
			value = featureData[key];

			if(keyData["type"] == "zero-float") // if one of the floats with range 0...1
			{
				if($(".graph-cont ." + key).length == 0) // if column doesn't exist, make it
					$(".graph-cont").append('<div class="graph-col ' + key + '"><div class="fill"></div>' + keyData["name"] + '</div>');

				$(".graph-col." + key + " .fill").css("height", value*100 + "%");
			}
		}
	}
}

/* Lifted from JMPerez JSFiddle http://jsfiddle.net/JMPerez/j1sqq4g0/ */
function login(callback) {
	var CLIENT_ID = '2edca4f106fc4672a68f5389579ac413';
	var REDIRECT_URI = origin + '/apollo/';

	function getLoginURL(scopes) {
		return 'https://accounts.spotify.com/authorize?client_id=' + CLIENT_ID +
		  '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
		  '&scope=' + encodeURIComponent(scopes.join(' ')) +
		  '&response_type=token';
	}
	
	var url = getLoginURL([
		// Specify scopes here, don't need any for track data fetching
		// 'playlist-modify-public'
	]);
	
	var width = 450,
		height = 730,
		left = (screen.width / 2) - (width / 2),
		top = (screen.height / 2) - (height / 2);

	window.addEventListener("message", function(event) {
		var hash = JSON.parse(event.data);
		if(hash["access_token"])
			callback(hash["access_token"]);

	}, false);
	
	var w = window.open(url,
		'Spotify',
		'menubar=no,location=no,resizable=no,scrollbars=no,status=no, width=' + width + ', height=' + height + ', top=' + top + ', left=' + left
	);
	
}