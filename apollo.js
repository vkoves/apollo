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
	setupGraph();

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
		spotifyApi.getTrack(trackId).then(showTrackInfo);
	});
});

// Callback for login completion, which updates buttons and sets access token in the API
function loginComplete(access_token)
{
	$("#spotify-authorize").addClass("disabled").text("Authorized!"); // indicate authorization worked
	$("#spotify-authorize").off(); // and disable the click event from being fired again
	$(".needs-auth").removeClass("disabled");

	spotifyApi.setAccessToken(access_token);
}

// Setup the audio feature graph, appending all needed columns
function setupGraph()
{
	for(key in spotifyGraphableData)
	{
		keyData = spotifyGraphableData[key];

		if(keyData["type"] == "zero-float") // if one of the floats with range 0...1
		{
			$(".graph-cont").append('<div class="graph-col ' + key + '">'
				+ '<div class="col-title">'
					+ keyData["name"]
					+ '<div class="col-desc">' + keyData["description"] + "</div>"
				+ "</div>"
				+ '<div class="fill"></div>'
				+ '<div class="value"></div>'
			+ '</div>');
		}
	}
}

// Graph the track's audio features based on the passed in audio data
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
				$(".graph-col." + key + " .value").text(value);

				if(value < 0.05) //if super small value
					$(".graph-col." + key + " .value").addClass("dark-text"); // make dark text for contrast
				else
					$(".graph-col." + key + " .value").removeClass("dark-text");

				$(".graph-col." + key + " .fill").css("height", value*100 + "%");
			}
		}
	}

	if(featureData.mode == 1) // major
		featureData.mode = "Major";
	else
		featureData.mode = "Minor";

	var pitches = ['C', 'C#', 'D', 'D#', 'E', 'E#', 'F', 'F#', 'G', 'G#'];
	featureData.key = pitches[featureData.key];

	$(".non-graph-data #key").text(featureData.key);
	$(".non-graph-data #tempo").text(featureData.tempo);
	$(".non-graph-data #time_signature").text(featureData.time_signature);
	$(".non-graph-data #mode").text(featureData.mode);
}

// Show information about the track from the passed in track data
function showTrackInfo(trackData)
{
	$(".album-image").attr("src", trackData.album.images[0].url);
	$(".track-text #title").text(trackData.name);
	$(".track-text #artists").text("by " + combineArtists(trackData.artists));

	// A helper function to combine all the artists into one nice string
	function combineArtists(artistsHash)
	{
		var artistNames = [];
		
		for(key in artistsHash)
		{
			artistNames.push(artistsHash[key].name);
		}

		return artistNames.join(", ");
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