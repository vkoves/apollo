/* Uses JMPerez Spotify JS Wrapper https://github.com/JMPerez/spotify-web-api-js */
var origin = "http://viktorkoves.com";

if(window.location.href.indexOf("localhost") > -1)
	origin = "http://localhost:4000";

$(document).ready(function()
{
	if(window.location.href.indexOf("access_token") > -1)
	{
		var dataToPass = {"access_token": window.location.href.split("access_token=")[1].split("&")[0]};
		window.opener.postMessage(JSON.stringify(dataToPass), origin);
		window.close(); //close the window
	}

	var spotifyApi = new SpotifyWebApi();

	$("#spotify-authorize").click(function()
	{
		console.log("Click!");

		login(function(access_token)
		{
			console.log("Login response");

			spotifyApi.setAccessToken(access_token);
			spotifyApi.getAudioFeaturesForTrack("22MQaNqXOkTUdg4rawaBCg").then(function(data)
			{
				console.log(data);
			});
		});
	});
});

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
		// 'playlist-modify-public'
	]);
	
	var width = 450,
		height = 730,
		left = (screen.width / 2) - (width / 2),
		top = (screen.height / 2) - (height / 2);

	window.addEventListener("message", function(event) {
		console.log("MSG" + event.data);
		var hash = JSON.parse(event.data);
		if(hash["access_token"])
			callback(hash["access_token"]);

	}, false);
	
	var w = window.open(url,
						'Spotify',
						'menubar=no,location=no,resizable=no,scrollbars=no,status=no, width=' + width + ', height=' + height + ', top=' + top + ', left=' + left
					   );
	
}