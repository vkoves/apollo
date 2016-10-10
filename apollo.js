/* Uses JMPerez Spotify JS Wrapper https://github.com/JMPerez/spotify-web-api-js */

/**
 *
 *  TODO:
 *
 *  - Use ranges specified in the descriptions of content to make some predictions (e.g. Spotify things this is an aoustic depressing song)
 *  - Add way of comparing two tracks
 *  - Add way of graphing these properties over an entire set of tracks, like a playlist or album
 *  - Track history during session (songs entered), so a user can go back and analyse a past analysed song
 *  - Add a way to search instead of using ID  spotifyApi.searchTracks(queryTerm, {limit: 5})
 */

var spotifyApi;
var origin = "http://viktorkoves.com"; // assume on production, and set origin variable as such
var audioObject; // for playing previews

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

	$("#get-track-data").click(getTrackDataClick);

	$(".search-submit").click(function()
	{
		spotifyApi.searchTracks($("#track-search").val(), {limit: 5}).then(handleSearch);
	})

	$("#track-search").keyup(function(e)
	{
		if(e.keyCode == 13)
		{
			spotifyApi.searchTracks($(this).val(), {limit: 5}).then(handleSearch);
		}
	});

	$(".album-image-cont").click(toggleRecord);
});

function getTrackDataClick()
{
	var trackInputData = $("#track-id").val();
	var trackId = trackInputData;

	if(trackInputData.indexOf("spotify:track:") == 0) // if URI, trim
		trackId = trackInputData.split("spotify:track:")[1];

	// Also can use getAudioFeaturesForTracks(Array<string>)
	spotifyApi.getAudioFeaturesForTrack(trackId).then(graphAudioFeatures, errorWithTrack);
	spotifyApi.getTrack(trackId).then(handleTrackInfo, errorWithTrack);
}

// Callback for login completion, which updates buttons and sets access token in the API
function loginComplete(access_token)
{
	$("#spotify-authorize").addClass("disabled").text("Authorized!"); // indicate authorization worked
	$("#spotify-authorize").off(); // and disable the click event from being fired again

	$(".pre-authorize").fadeOut(function()
	{
		$(".post-authorize").fadeIn();			
	});

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
				+ '<div class="fill">'
					+ '<div class="value"></div>'
				+ '</div>'
			+ '</div>');
			$(".graph-labels").append(""
			+ '<div class="col-title ' + key + '">'
				+ '<div class="col-icon"></div>'
				+ '<span>' + keyData["name"] + '</span>'
				+ '<div class="col-desc">' + keyData["description"] + "</div>"
			+ "</div>");
		}
	}
}

// Graph the track's audio features based on the passed in audio data
function graphAudioFeatures(featureData)
{
	$(".track-cont").show();
	$(".track-info").show();
	$("#track-error").hide();

	for(key in featureData) // iterate through each feature attribute
	{
		if(key in spotifyGraphableData) // and graph if it's in the list of allowed data to graph
		{
			keyData = spotifyGraphableData[key];
			value = featureData[key];

			if(keyData["type"] == "zero-float") // if one of the floats with range 0...1
			{
				$(".graph-col." + key + " .value").text(value);
				$(".graph-col." + key + " .fill").css("height", value*100 + "%");
			}
		}
	}

	if(featureData.mode == 1) // major
		featureData.mode = "Major";
	else
		featureData.mode = "Minor";

	var pitches = ['C', 'C#', 'D', 'D#', 'E', 'E#', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'B#'];
	featureData.key = pitches[featureData.key];
	featureData.duration = getProperDuration(featureData.duration_ms)

	$(".non-graph-data #key").text(featureData.key);
	$(".non-graph-data #tempo").text(featureData.tempo);
	$(".non-graph-data #time_signature").text(featureData.time_signature);
	$(".non-graph-data #mode").text(featureData.mode);
	$(".non-graph-data #loudness").text(featureData.loudness);
	$(".non-graph-data #duration").text(featureData.duration);

	function getProperDuration(duration_ms)
	{
		var minutes = Math.floor(duration_ms/(1000*60));
		var seconds = Math.floor((duration_ms/1000)%60);

		if(seconds < 10) //need zero buffering
			seconds = "0" + seconds;
		
		return minutes + ":" + seconds; // get proper duration using math
	}
}

// Show information about the track from the passed in track data
function handleTrackInfo(trackData)
{
	// Audio playing from http://jsfiddle.net/JMPerez/0u0v7e1b/
	if(audioObject)
		audioObject.pause(); // pause if playing
	audioObject = new Audio(trackData.preview_url);
	audioObject.addEventListener('ended', function()
	{
		hideRecord(400);
	});

	$(".album-image").attr("src", trackData.album.images[0].url);
	$(".track-text #title").text(trackData.name);
	$(".track-text #artists").text("by " + combineArtists(trackData.artists));
}

// Called as a result of calling the search API call
function handleSearch(data)
{
	$(".search-results").html(""); // clear the HTML of the search results

	for(key in data.tracks.items) // iterate through tracks
	{
		var track = data.tracks.items[key];
		$(".search-results").append('<div class="search-listing" data-uri=' + track.uri + '>'
			+ '<img src="' + track.album.images[0].url + '">'
			+ '<div class="listing-text">'
				+ '<span class="track-title">' + track.name + '</span><br><span class="author">by ' + combineArtists(track.artists) + '</span>'
			+ '</div>'
		+ '</div>');
	}
	$(".search-results").slideDown();

	$(".search-listing").click(function()
	{
		$("#track-id").val($(this).attr("data-uri"));
		$(".search-results").hide();
		getTrackDataClick();
	});
}

function toggleRecord()
{
	var speed = 400;

	if($(".album-image-cont").hasClass("playing"))
		hideRecord(speed);
	else
		showRecord(speed);
}

function showRecord(speed)
{
	if(audioObject)
	{
		$(".album-image-cont .record").removeClass("hidden");
		$( ".album-image-cont .record" ).animate({
			top: "-100%"
		}, speed, function() {
			$(".album-image-cont").addClass("playing");
			$(this).animate({
				top: "2%"
			}, speed, function()
			{
				audioObject.play();
			});
		});
	}
}

function hideRecord(speed)
{
	console.log("HIDE!");
	if(audioObject)
	{
		audioObject.pause();
		$( ".album-image-cont .record" ).animate({
			top: "-100%"
		}, speed, function() {
			$(".album-image-cont").removeClass("playing");
			$(this).animate({
				top: "-10%"
			}, speed, function()
			{
				$(".album-image-cont .record").addClass("hidden");
			});
		});
	}	
}

// Callback for API calls that shows an error
function errorWithTrack()
{
	$("#track-error").show();
	$(".track-cont").hide();
}

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