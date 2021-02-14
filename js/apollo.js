/**
 * All the Apollo JS code
 *
 * Uses JMPerez Spotify JS Wrapper https://github.com/JMPerez/spotify-web-api-js
 */

/** Make sure ESLint knows we will have access to these two */
/* global spotifyGraphableData, SpotifyWebApi, Vue */

/**
 *
 *  TODO:
 *
 *      CLEANING
 *  - Make it so each of the four views has data that properly persists, so switching between views works fine. Probably want to do this using JS for data storange
 *      rather than DOM to keep things light weight?
 *
 *      FEATURES
 *  - Use ranges specified in the descriptions of content to make some predictions (e.g. Spotify things this is an aoustic depressing song)
 *  - Add way of comparing two tracks
 *  - Add way of graphing audio features over an entire set of tracks, like a playlist or album
 *  - Track history during session (songs entered), so a user can go back and analyse a past analysed song
 *  - DONE: Add a way to search instead of using ID  spotifyApi.searchTracks(queryTerm, {limit: 5})
 */

/** The Vue app instance */
var VueApp;

var spotifyApi;
var currOrigin = 'https://viktorkoves.com'; // assume on production, and set origin variable as such
var audioObject; // for playing previews

var spotifyObjectType = 'track'; // the type of object being manipulated in the current view. String that can be "track", "album", "playlist"

// Used for single song analysis
var track = {};

// Used for song compare
var track1 = {};
var track2 = {};

// Used for album analysis
var album = {};
var albumAnalysisResults = {}; //stores the average and the std. dev

// Used for playlist analysis
var playlist = {};
var playlistAnalysisResults = {}; //stores the average and std. dev

if (window.location.href.indexOf('localhost') > -1) { // if we're on localhost after all
    // likewise set the origin to reflect this
    currOrigin = 'http://localhost:4000';
}

$(document).ready(function()
{
    VueApp = new Vue({
        el: '#app',
        // Jekyll uses Liquid, which would interpret {{ }} on compile time, so we move
        // Vue to use (( )) instead
        delimiters: ['((', '))'],
        data: {
            /** Whether the user is logged in or not */
            isLoggedIn: false,

            /**
             * The ID of the current menu object. Can be song, song-compare,
             * album, or playlist
             */
            currentView: 'song',

            /**
             * Whether the current view is empty (not showing data), which makes
             * the search more prominent
             */
            viewEmpty: false,

            searchItems: undefined,

            /** Text of the search/URI input */
            searchText: '',

            /** The currently selected track that the user is updating. Most
                important on song-compare */
            selectedTrackNum: 1,

            /** View data objects */
            album: undefined,
            playlist: undefined,
            track1: undefined,
            track2: undefined,
            track: undefined,

            songExtraData: undefined,
            spotifyGraphableData: spotifyGraphableData,
        },
        methods: {
            login: () => login(loginComplete),
            /**
             * Expose functions defined in this file to Vue
             */
            searchResultClick: searchResultClick,
            selectSong: selectSong,
            shareOnTwitter: shareOnTwitter,
            spotifySearch: spotifySearch,
            switchView: switchView,
            toggleRecord: toggleRecord
        }
    });

    if (window.location.href.indexOf('access_token') > -1) // if this is a redirect from Spotify authorization
    {
        var dataToPass = {'access_token': window.location.href.split('access_token=')[1].split('&')[0]}; // create a hash with the data to pass to the other window
        window.opener.postMessage(JSON.stringify(dataToPass), currOrigin); // andd pass the data to the original window (the one that opened this one)
        window.close(); // then close this window
    }

    spotifyApi = new SpotifyWebApi(); // init SpotifyWebApi

    // Attempt auto-login
    autoLogin();
});

/**
 * Switches to the view that is being requested per click in the menu
 */
function switchView(viewToSwitchTo)
{
    // If already on this view, do nothing
    if (VueApp.currentView === viewToSwitchTo) {
        return;
    }

    VueApp.currentView = viewToSwitchTo;

    pushStateToHistory(); // push to history after VueApp.currentView var has changed

    pausePlayingRecord();
    clearInput();

    if (VueApp.currentView === 'song')
    {
        VueApp.selectedTrackNum = 1;

        spotifyObjectType = 'track';

        if (Object.keys(track).length > 0) // if track is defined
        {
            setupFilledView();
            graphAudioFeatures(track.audioFeatures);
            handleTrackInfo(track.trackObject);
        }
        else
        {
            setupEmptyView();
        }
    }
    else if (VueApp.currentView === 'song-compare')
    {
        // Setup an empty view if no tracks are dfined
        if (Object.keys(track1).length === 0 && Object.keys(track2).length === 0) {
            setupEmptyView();
        }
        else
        {
            setupFilledView();
        }

        if (Object.keys(track1).length > 0) // if track1 is defined
        {
            VueApp.selectedTrackNum = 1;
            graphAudioFeatures(track1.audioFeatures);
            handleTrackInfo(track1.trackObject);
        }

        if (Object.keys(track2).length > 0) // if track2 is defined
        {
            VueApp.selectedTrackNum = 2;
            graphAudioFeatures(track2.audioFeatures);
            handleTrackInfo(track2.trackObject);
        }

        VueApp.selectedTrackNum = 1;

        spotifyObjectType = 'track';

    }
    else if (VueApp.currentView === 'album')
    {
        spotifyObjectType = 'album';

        // If album has not been defined yet
        if (Object.keys(album).length === 0) {
            setupEmptyView();
        }
        else
        {
            graphAnalysisResults();
            setupFilledView();
        }
    }
    else if (VueApp.currentView === 'playlist')
    {
        spotifyObjectType = 'playlist';

        // If playlist has not been defined yet
        if (Object.keys(playlist).length === 0) {
            setupEmptyView();
        }
        else {
            graphAnalysisResults();
            setupFilledView();
        }
    }
}

// Puts in a search request
function spotifySearch()
{
    const textInput = VueApp.searchText;

    // Spotify URIs always start with spotify:, which isn't likely to be a
    // search query, so if we get that, fetch by URI
    if (textInput.startsWith('spotify:')) {
        getSpotifyData(textInput);
        return;
    }

    if (spotifyObjectType === 'track') {
        spotifyApi.searchTracks(textInput, { limit: 5 })
            .then(handleSearch);
    }
    else if (spotifyObjectType === 'album') {
        spotifyApi.searchAlbums(textInput, { limit: 5 })
            .then(handleSearch);
    }
    else if (spotifyObjectType === 'playlist') {
        spotifyApi.searchPlaylists(textInput, { limit: 5 })
            .then(handleSearch);
    }
}

// Reads the URI field and updates data as needed
function getSpotifyData(spotifyURI)
{
    setupFilledView();

    var spotifyId = spotifyURI;

    if (spotifyURI.indexOf('spotify:' + spotifyObjectType + ':') === 0) { // if URI, trim
        spotifyId = spotifyURI.split('spotify:' + spotifyObjectType + ':')[1];
    }

    if (spotifyObjectType === 'track')
    {
        // Also can use getAudioFeaturesForTracks(Array<string>)
        spotifyApi.getAudioFeaturesForTrack(spotifyId).then(graphAudioFeatures, spotifyError);
        spotifyApi.getTrack(spotifyId).then(function(data) {
            handleTrackInfo(data, true);
        }, spotifyError);
    }
    else if (spotifyObjectType === 'album')
    {
        spotifyApi.getAlbum(spotifyId)
            .then(handleAlbum, spotifyError);
    }
    else if (spotifyObjectType === 'playlist')
    {
        let actualUri;

        // User playlists have a URI like so:
        // spotify:user:USERID:playlist:PLAYLISTID
        if (spotifyURI.includes('user')) {
            actualUri = spotifyURI.split(':')[4];
        }
        // Other (like Spotify official) playlists have URIs like so:
        // spotify:playlist:37i9dQZF1DXa1rZf8gLhyz
        else {
            actualUri = spotifyURI.split(':')[2];
        }

        spotifyApi.getPlaylist(actualUri)
            .then(handlePlaylist, spotifyError);
    }
}

// Sets the track1 and track2 variables
function setTrackData(data, isFeatures)
{
    var currTrack = track; //default to song mode track

    if (VueApp.currentView === 'song-compare') {
        if (VueApp.selectedTrackNum === 2) {
            currTrack = track2;
        }
        else {
            currTrack = track1;
        }
    }

    if (isFeatures) {
        currTrack.audioFeatures = data;
    }
    else {
        currTrack.trackObject = data;
    }
}

/**
 * Graph the track's audio features based on the passed in audio data
 *
 * TODO: Move to Vue
 */
function graphAudioFeatures(featureData)
{
    setTrackData(featureData, true);

    $('#spotify-error').hide();

    for (var key in featureData) // iterate through each feature attribute
    {
        // and graph if it's in the list of allowed data to graph
        if (key in spotifyGraphableData) {
            var keyData = spotifyGraphableData[key];
            var value = featureData[key];

            // if one of the floats with range 0...1
            if (keyData['type'] === 'zero-float') {
                if (VueApp.currentView === 'song-compare')
                {
                    $('.graph-col.' + key + ' .value-' + VueApp.selectedTrackNum).text(value);
                    $('.graph-col.' + key + ' .fill-' + VueApp.selectedTrackNum).css('height', value*100 + '%');
                }
                else
                {
                    $('.graph-col.' + key + ' .value').text(value);
                    $('.graph-col.' + key + ' .fill').css('height', value*100 + '%');
                }
            }
        }
    }

    if (featureData.mode === 1) // major
    {
        featureData.mode = 'Major';
    }
    else
    {
        featureData.mode = 'Minor';
    }

    var pitches = ['C', 'C#', 'D', 'D#', 'E', 'E#', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'B#'];
    featureData.key = pitches[featureData.key];
    featureData.duration = getProperDuration(featureData.duration_ms);

    // If viewing an individual song, show data for that song
    if (VueApp.currentView === 'song')
    {
        VueApp.songExtraData = {
            key: featureData.key,
            tempo: featureData.tempo,
            timeSignature: featureData.time_signature,
            mode: featureData.mode,
            loudness: featureData.loudness,
            duration: featureData.duration,
        };
    }

    /**
     * Convert a ms song duration to the human readable minute second format
     */
    function getProperDuration(duration_ms)
    {
        var minutes = Math.floor(duration_ms/(1000*60));
        var seconds = Math.floor((duration_ms/1000)%60);

        if (seconds < 10) //need zero buffering
        {
            seconds = '0' + seconds;
        }

        return minutes + ':' + seconds; // get proper duration using math
    }
}

/**
 * Select the song to currently be selectable in the song compare view
 */
function selectSong(trackNum) {
    VueApp.selectedTrackNum = trackNum;
}

/**
 * Show information about the track from the passed in track data
 *
 * TODO: Move to Vue
 */
function handleTrackInfo(trackData, pushHistory)
{
    setTrackData(trackData, false);

    // After track data is set (track, track1, or track2) objects, push history
    if (pushHistory)
    {
        pushStateToHistory();
    }

    // Audio playing from http://jsfiddle.net/JMPerez/0u0v7e1b/
    pausePlayingRecord();

    if (trackData.preview_url) // some songs don't have previews. Try "Gimme Gimme" by Louis La Roche - spotify:track:0EiwsLRU0PXK2cIjGXsiaa (works when searching?)
    {
        audioObject = new Audio(trackData.preview_url);
        audioObject.addEventListener('ended', function() {
            hideRecord($('.album-image-cont.playing .record'), 400);
        });
    }
    else
    {
        audioObject = null;
    }

    const imgUrl = trackData.album.images[0].url;

    if (VueApp.currentView === 'song-compare') {
        if (VueApp.selectedTrackNum === 1) {
            VueApp.track1 = { imgUrl };
        }
        else {
            VueApp.track2 = { imgUrl };
        }
    }
    // If viewing individual song, update title
    else if (VueApp.currentView === 'song')
    {
        VueApp.track = {
            imgUrl,
            name: trackData.name,
            artists: 'by ' + combineArtists(trackData.artists)
        };
    }
}

// Analyzes an album, getting the audio features for the tracks on it
function handleAlbum(albumData)
{
    album = albumData;

    const imgUrl = albumData.images[0].url;

    VueApp.album = {
        imgUrl,
        name: albumData.name,
        uri: albumData.uri,
        artists: 'By ' + combineArtists(albumData.artists)
    };

    spotifyApi.getAudioFeaturesForTracks(getTrackIds(albumData.tracks.items))
        .then(analyzeAudioFeatures, spotifyError);
}

// Analyzes a playlist, getting the audio features for the tracks on it
function handlePlaylist(playlistData)
{
    playlist = playlistData;

    const imgUrl = playlistData.images[0].url;

    VueApp.playlist = {
        imgUrl,
        name: playlistData.name,
        uri: playlistData.uri,
    };

    spotifyApi.getAudioFeaturesForTracks(getTrackIds(playlistData.tracks.items, true))
        .then(analyzeAudioFeatures, spotifyError);
}

// Analayzes a set of audio features, determining the average, median and standard deviation for each of the graphable values
function analyzeAudioFeatures(data)
{
    var audioFeatures = data.audio_features;

    // Step 1 - sum up each graphable value (first half of getting averages)
    var sums = {};

    iterateThroughFeatures(false);

    // Step 2 - average the sums
    var averages = {};

    for (var key in sums) {
        var sum = sums[key];
        averages[key] = sum / audioFeatures.length;
    }

    // Step 3 - start to get the standard deviation by iterating through again and getting the sum of the squares of the difference of each value of the mean
    var differenceSquareSums = {}; // stores the sum of the square of the differences

    iterateThroughFeatures(true);

    // Step 4 - sqrt all of the sums to get the final standard deviation
    var standardDeviations = {};

    for (key in differenceSquareSums) {
        // std. deviation is the sqrt of the sum of the squares of the
        // differences from the average
        standardDeviations[key] = Math.sqrt(differenceSquareSums[key]);
    }

    // Wrap up by saving the data so we don't recompute this
    if (spotifyObjectType === 'album') {
        albumAnalysisResults = {
            averages,
            standardDeviations
        };
    }
    else if (spotifyObjectType === 'playlist') {
        playlistAnalysisResults = {
            averages,
            standardDeviations
        };
    }

    graphAnalysisResults(true); //and graph it all, pushing to history

    // A helper function to iterate through all features, either summing up the
    // values, or getting differences from the average.
    // Needed since the data has to be run through twice (first pass for
    // averages, second pass for std. deviation)
    function iterateThroughFeatures(averagesCompleted)
    {
        // iterate through each set of features (each is the audio features for one track) {
        for (var featuresKey in audioFeatures) {
            var audioFeature = audioFeatures[featuresKey];

            for (var key in audioFeature) {
                // analyze if this data is graphable
                if (key in spotifyGraphableData && spotifyGraphableData[key].type === 'zero-float') {
                    var value = audioFeature[key];

                    if (averagesCompleted) {
                        if (key in differenceSquareSums) {
                            differenceSquareSums[key] += Math.pow(averages[key] - value, 2);
                        }
                        else {
                            differenceSquareSums[key] = Math.pow(averages[key] - value, 2);
                        }
                    }
                    else {
                        if (key in sums) {
                            sums[key] += value;
                        }
                        else {
                            sums[key] = value;
                        }
                    }
                }
            }
        }
    }
}

/**
 * Graph audio analysis details for an image
 *
 * TODO: Convert to Vue
 */
function graphAnalysisResults(pushHistory)
{
    if (pushHistory) {
        pushStateToHistory();
    }

    $('.std-dev').remove(); // remove old analysis data

    var analysisResultsObj;

    if (spotifyObjectType === 'album')
    {
        analysisResultsObj = albumAnalysisResults;
    }
    else if (spotifyObjectType === 'playlist')
    {
        analysisResultsObj = playlistAnalysisResults;
    }

    var average, stdDev;

    for (var key in analysisResultsObj.averages)
    {
        average = analysisResultsObj.averages[key];
        stdDev = analysisResultsObj.standardDeviations[key];

        $('.graph-col.' + key + ' .value').text(average);
        $('.graph-col.' + key + ' .fill').css('height', average*100 + '%');
        $('.col-title.' + key + ' span').after('<div class=\'std-dev\'>Std. Dev.<br>' + stdDev + '</div>');
    }
}

/**
 * Called as a result of calling the search API call, and renders search results
 *
 * TODO: Convert to Vue
 */
function handleSearch(data)
{
    // Determine the objects to iterate through depending on what type of objects we are dealing with
    var items;

    if (spotifyObjectType === 'track') {
        items = data.tracks.items;
    }
    else if (spotifyObjectType === 'album') {
        items = data.albums.items;
    }
    else if (spotifyObjectType === 'playlist') {
        items = data.playlists.items;
    }

    // Map search items to pick the ideal image and get an artists line
    VueApp.searchItems = items.map(spotifyObj => {
        var artists = ''; // by line for artists=
        var images;

        if (spotifyObjectType === 'track') {
            images = spotifyObj.album.images;
        }
        else {
            images = spotifyObj.images;
        }

        if (spotifyObj.artists) {
            artists = combineArtists(spotifyObj.artists);
        }

        // try to use second image, fallback to first if only one
        var idealImage = images[1] || images[0];

        return {
            artists,
            imageUrl: idealImage.url,
            name: spotifyObj.name,
            uri: spotifyObj.uri
        };
    });
}

/**
 * Called on click of a search result item
 */
function searchResultClick(uri) {
    clearInput();
    getSpotifyData(uri);
}

/**
 * Hides the search and clears the input fields
 */
function clearInput()
{
    VueApp.searchText = '';
    VueApp.searchItems = undefined;
}

/**
 * Modify the body and input-bar-cont to indicate the current view is empty
 */
function setupEmptyView(callback)
{
    VueApp.viewEmpty = true;

    if (callback) {
        setTimeout(callback, 500);
    }
}

/**
 * Indicate the current view is showing data
 */
function setupFilledView()
{
    VueApp.viewEmpty = false;
}

// Toggle between the record being hidden and not hidden
// Called on click by ".album-image-cont" objects, so we search for a ".record" child to pass to hideRecord() and showRecord()
function toggleRecord(clickEvent)
{
    var recordElem = clickEvent.currentTarget.children[0];

    var speed = 400;

    if (clickEvent.currentTarget.classList.contains('playing')) {
        hideRecord(recordElem, speed);
    }
    else {
        showRecord(recordElem, speed);
    }
}

/**
 * Show the record, playing the audioObject when the animation ends
 *
 * @param  {HtmlElement} element The ".record" element to animate
 * @param  {integer} speed Speed of the animation in ms
 */
function showRecord(element, speed)
{
    const elem = $(element);

    if (audioObject)
    {
        pausePlayingRecord();

        var currTrack = track;

        // If track 1
        if (elem.closest('#track-1').length > 0) {
            currTrack = track1;
        }
        else if (elem.closest('#track-2').length > 0) {
            currTrack = track2;
        }

        audioObject.src = currTrack.trackObject.preview_url;

        elem.removeClass('hidden');
        elem.animate({
            top: '-100%'
        }, speed, function() {
            elem.parent().addClass('playing');
            $(this).animate({
                top: '2%'
            }, speed, function()
            {
                audioObject.play();
            });
        });
    }
}
/**
 * Hide the record, pausing immediately then animating back to normal position
 * Animation goes from 2% (centered onrecord) to -100% (fully off record) to -10% (peeking out behind record)
 * We remove the playing class when the record is fully out to make the record move from in front of the album art
 * to behind it. We also add the hidden class when animation is done for hover effects
 *
 * @param  {HtmlElement Object} element  The ".record" object to animate
 * @param  {integer} speed Speed of the animation in ms
 *
 * TODO: Convert to Vue
 */
function hideRecord(element, speed)
{
    const elem = $(element);

    if (audioObject)
    {
        audioObject.pause();
        elem.animate({
            top: '-100%'
        }, speed, function() {
            elem.parent().removeClass('playing');
            $(this).animate({
                top: '-10%'
            }, speed, function()
            {
                elem.addClass('hidden');
            });
        });
    }
}

// If a record is playing, pauses it and hides
function pausePlayingRecord()
{
    if (audioObject)
    {
        audioObject.pause(); // pause if playing
        hideRecord($('.album-image-cont.playing .record'), 400);
    }
}

// Callback for API calls that shows an error message
function spotifyError()
{
    $('#spotify-error').show();
}

// A helper function to combine all the artists into one nice string
function combineArtists(artistsHash)
{
    var artistNames = [];

    for (var key in artistsHash) {
        artistNames.push(artistsHash[key].name);
    }

    return artistNames.join(', ');
}

// A helper function that returns an array of track IDs given an array of tracks
function getTrackIds(tracks, isPlaylist)
{
    var trackIds = [];

    for (var index in tracks) {
        var trackObj = tracks[index];

        if (isPlaylist) { //there's another level of nesting with playlists
            trackIds.push(trackObj.track.id);
        }
        else {
            trackIds.push(trackObj.id);
        }
    }

    return trackIds;
}

// Pushes to history based on the current app state
function pushStateToHistory()
{
    history.pushState({
        currentView: VueApp.currentView,
        spotifyObjData: generateDataHash(),
    }, null, generateURL());

    // Generates a URL that uniquely identifies this
    function generateURL()
    {
        var url = '?';

        if (!VueApp.currentView) {
            return;
        }

        url += 'currView=' + VueApp.currentView;

        // Push data of what Spotify objects are loaded, if they are loaded
        if (VueApp.currentView === 'song' && track.trackObject) {
            url += '&track=' + track.trackObject.uri;
        }
        else if (VueApp.currentView === 'song-compare'
            && track1.trackObject && track2.trackObject) { // only push song compare state with both songs defined
            url += '&track1=' + track1.trackObject.uri + '&track2=' + track2.trackObject.uri;
        }
        else if (VueApp.currentView === 'album' && VueApp.album) {
            url += '&album=' + VueApp.album.uri;
        }
        else if (VueApp.currentView === 'playlist' && VueApp.playlist) {
            url += '&playlist=' + VueApp.playlist.uri;
        }

        return url;
    }

    // Generates a hash of the currently used data for this view. Doesn't save all data
    function generateDataHash()
    {
        var hash = {};

        if (VueApp.currentView === 'song') {
            hash[track] = track;
        }
        else if (VueApp.currentView === 'song-compare') {
            hash[track1] = track1;
            hash[track2] = track2;
        }
        else if (VueApp.currentView === 'album') {
            hash[album] = album;
        }
        else if (VueApp.currentView === 'playlist') {
            hash[playlist] = playlist;
        }

        return hash;
    }
}

// Loads Apollo's state from the URL
function loadStateFromURL()
{
    var params = getParameterHash();

    if (params['currView']) {
        switchView(params['currView']);

        if (VueApp.currentView === 'song' && params['track']) {
            getSpotifyData(params['track']);
        }
        else if (VueApp.currentView === 'song-compare' && params['track1'] && params['track2']) {
            VueApp.selectedTrackNum = 2;

            getSpotifyData(params['track2']);

            setTimeout(function() {
                VueApp.selectedTrackNum = 1;
                getSpotifyData(params['track1']);
            }, 500);

        }
        else if (VueApp.currentView === 'album' && params['album']) {
            getSpotifyData(params['album']);
        }
        else if (VueApp.currentView === 'playlist' && params['playlist']) {
            getSpotifyData(params['playlist']);
        }
    }

    function getParameterHash() {
        // Trim '?' from string start, then split by '&'
        var paramsArr = window.location.search.substr(1).split('&');
        var params = {};
        var currParam = [];

        for (var i = 0; i < paramsArr.length; i++) {
            currParam = paramsArr[i].split('=');
            params[currParam[0]] = currParam[1];
        }

        return params;
    }
}

/***************************/
/***** LOGIN FUNCTIONS *****/
/***************************/

/**
 * Show a Spotify auth window to prompt the user to login with their Spotify. If
 * they're already logged in, this window will open and close immediately.
 *
 * Copied from JMPerez's JSFiddle: http://jsfiddle.net/JMPerez/j1sqq4g0/
 */
function login(callback) {
    var CLIENT_ID = '2edca4f106fc4672a68f5389579ac413';
    var REDIRECT_URI = currOrigin + '/apollo/';

    function getLoginURL(scopes) {
        return 'https://accounts.spotify.com/authorize?client_id=' + CLIENT_ID +
          '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
          '&scope=' + encodeURIComponent(scopes.join(' ')) +
          '&response_type=token';
    }

    // Specify scopes here, don't need any for track data fetching since that's
    // not related to the user at all
    const scopes = [];

    var url = getLoginURL(scopes);

    var width = 450,
        height = 730,
        left = (screen.width / 2) - (width / 2),
        top = (screen.height / 2) - (height / 2);

    window.addEventListener('message', function(event) {
        var hash = JSON.parse(event.data);

        if (hash['access_token']) {
            callback(hash['access_token']);
        }

    }, false);

    window.open(url,
        'Spotify',
        'menubar=no,location=no,resizable=no,scrollbars=no,status=no, width=' + width + ', height=' + height + ', top=' + top + ', left=' + left
    );
}

/**
 * Try to login with a previous access token stored in sessionStorage. Does NOT
 * run if we see the #home hash in the header, which is usefulf or testing or
 * if people click the home link
 */
function autoLogin() {
    // Guard against #home anchor, which ignores auto-login
    if (location.href.split('#')[1] === 'home') {
        return;
    }

    const oldToken = sessionStorage.getItem('accessToken');

    if (oldToken) {
        loginComplete(oldToken);
    }
}

/**
 * Callback for login completion, which updates buttons and sets the access
 * token in the API
 */
function loginComplete(accessToken)
{
    sessionStorage.setItem('accessToken', accessToken);

    VueApp.isLoggedIn = true;

    // Setup first view, which is empty
    setupEmptyView();

    spotifyApi.setAccessToken(accessToken);

    if (window.location.search) {
        loadStateFromURL();
    }
    else {
        pushStateToHistory();
    }
}

/***************************/
/*** END LOGIN FUNCTIONS ***/
/***************************/


/**
 * Social Media Sharing Functions
 */
function shareOnTwitter() {
    var shareurl = escape(window.location.href);

    window.open(
        'https://twitter.com/share?url=' + shareurl + '&text=' + document.title,
        '',
        'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=300,width=600');
}
