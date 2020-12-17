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

var albumTarget; // the target album to update. Type jQuery element
var trackNumber = 1; //number of track we're setting data for (either 1 or 2)

var spotifyObjectType = 'track'; // the type of object being manipulated in the current view. String that can be "track", "album", "playlist"

var currentView = 'song'; //stores the ID of the current menu object. Can be song, song-compare, album, or playlist

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
            viewEmpty: true,
        },
        methods: {
            login: () => login(loginComplete)
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
 * A temporary functionf or setting up event listeners after auth.
 *
 * TODO: Deprecate this function, as all these event handlers should be in Vue
 */
function setupPostLoginEvents() {
    setupGraph();

    albumTarget = $('.single-song-module .album-image-cont'); //set default target album to single song album

    $('#submit-btn').click(getSpotifyData);

    $('.search-submit').click(spotifySearch);

    $('#search-field').keyup(function(e)
    {
        if (e.keyCode == 13) { // if enter was pressed
            spotifySearch();
        }
    });

    $('.album-image-cont').click(toggleRecord);

    $('.menu-option').click(switchView);

    $('.song-select .option').click(function()
    {
        $('.song-select .option').removeClass('active');
        $(this).addClass('active');
        if ($(this).attr('id') == 'track-1-select') {
            albumTarget = $('#track-1');
            trackNumber = 1;
        }
        else
        {
            albumTarget = $('#track-2');
            trackNumber = 2;
        }
    });

    // Sharing stuff
    $('.fb-share').click( function()
    {
        var shareurl = escape(window.location.href);
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + shareurl + '&t=' + document.title, '',
            'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=300,width=600');
    });

    $('.twitter-share').click(function()
    {
        var shareurl = escape(window.location.href);
        window.open('https://twitter.com/share?url=' + shareurl + '&text=' +document.title, '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=300,width=600');
    });
}

// Switches to the view that is being requested per click in the menu
// Optionally takes a string of the view desired, to allow for JS based switched
function switchView(event, viewToSwitchTo)
{
    if (viewToSwitchTo && $('.menu-option#' + viewToSwitchTo).length > 0) // only use viewToSwitchTo if it's valid (has a menu item with its ID)
    {
        currentView = viewToSwitchTo;
        $('.menu-option').removeClass('active');
        $('.menu-option#' + viewToSwitchTo).addClass('active');
    }
    else
    {
        if (this == $('.menu-option.active')[0]) { //if clicking the current view, don't do anything
            return;
        }

        $('.menu-option').removeClass('active');
        $(this).addClass('active');

        currentView = $(this).attr('id');
    }


    pushStateToHistory(); // push to history after currentView var has changed

    pausePlayingRecord();
    clearInput();

    if (currentView == 'song')
    {
        albumTarget = $('.single-song-module .album-image-cont');
        trackNumber = 1;

        spotifyObjectType = 'track';

        if (Object.keys(track).length > 0) // if track is defined
        {
            switchViewVisuals();
            setupFilledView();
            graphAudioFeatures(track.audioFeatures);
            handleTrackInfo(track.trackObject);
        }
        else
        {
            setupEmptyView(switchViewVisuals);
        }
    }
    else if (currentView == 'song-compare')
    {
        // Setup an empty view if no tracks are dfined
        if (Object.keys(track1).length == 0 && Object.keys(track2).length == 0) {
            setupEmptyView(switchViewVisuals);
        }
        else
        {
            switchViewVisuals();
            setupFilledView();
        }

        if (Object.keys(track1).length > 0) // if track1 is defined
        {
            albumTarget = $('#track-1');
            trackNumber = 1;
            graphAudioFeatures(track1.audioFeatures);
            handleTrackInfo(track1.trackObject);
        }

        if (Object.keys(track2).length > 0) // if track2 is defined
        {
            albumTarget = $('#track-2');
            trackNumber = 2;
            graphAudioFeatures(track2.audioFeatures);
            handleTrackInfo(track2.trackObject);
        }

        $('#track-2-select').removeClass('active');
        $('#track-1-select').addClass('active');
        albumTarget = $('#track-1');
        trackNumber = 1;

        spotifyObjectType = 'track';

    }
    else if (currentView == 'album')
    {
        spotifyObjectType = 'album';

        // If album has not been defined yet
        if (Object.keys(album).length == 0) {
            setupEmptyView(switchViewVisuals);
        }
        else
        {
            switchViewVisuals();
            graphAnalysisResults();
            setupFilledView();
        }
    }
    else if (currentView == 'playlist')
    {
        spotifyObjectType = 'playlist';

        // If playlist has not been defined yet
        if (Object.keys(playlist).length == 0) {
            setupEmptyView(switchViewVisuals);
        }
        else {
            switchViewVisuals();
            graphAnalysisResults();
            setupFilledView();
        }
    }

    // Handles hiding old modules and showing needed ones for the new currentView
    function switchViewVisuals()
    {
        // start by hiding all modules
        $('.single-song-module, .compare-songs-module, .album-module, .playlist-module').hide();

        // then show needed modules
        if (currentView == 'song') {$('.single-song-module').show();}
        else if (currentView == 'song-compare') {$('.compare-songs-module').show();}
        else if (currentView == 'album') {$('.album-module').show();}
        else if (currentView == 'playlist') {$('.playlist-module').show();}

        setupGraph(); //resetup graph for this view
    }
}

// Puts in a search request
function spotifySearch()
{
    if (spotifyObjectType == 'track') {
        spotifyApi.searchTracks($('#search-field').val(), { limit: 5 })
            .then(handleSearch);
    }
    else if (spotifyObjectType == 'album') {
        spotifyApi.searchAlbums($('#search-field').val(), { limit: 5 })
            .then(handleSearch);
    }
    else if (spotifyObjectType == 'playlist') {
        spotifyApi.searchPlaylists($('#search-field').val(), { limit: 5 })
            .then(handleSearch);
    }
}

// Reads the URI field and updates data as needed
function getSpotifyData(event, spotifyURI)
{
    setupFilledView();

    if (!spotifyURI) { // if URI wasn't passed in, use value from spotify-id
        spotifyURI = $('#spotify-id').val();
    }

    var spotifyId = spotifyURI;

    if (spotifyURI.indexOf('spotify:' + spotifyObjectType + ':') == 0) { // if URI, trim
        spotifyId = spotifyURI.split('spotify:' + spotifyObjectType + ':')[1];
    }

    if (spotifyObjectType == 'track')
    {
        // Also can use getAudioFeaturesForTracks(Array<string>)
        spotifyApi.getAudioFeaturesForTrack(spotifyId).then(graphAudioFeatures, spotifyError);
        spotifyApi.getTrack(spotifyId).then(function(data) {
            handleTrackInfo(data, true);
        }, spotifyError);
    }
    else if (spotifyObjectType == 'album')
    {
        spotifyApi.getAlbum(spotifyId).then(handleAlbum, spotifyError);
    }
    else if (spotifyObjectType == 'playlist')
    {
        spotifyApi.getPlaylist(spotifyURI.split(':')[2], spotifyURI.split(':')[4]).then(handlePlaylist, spotifyError);
    }
}

// Setup the audio feature graph, appending all needed columns
function setupGraph()
{
    $('.graph-cont, .graph-labels').html(''); //clear container and labels

    for (var key in spotifyGraphableData)
    {
        var keyData = spotifyGraphableData[key];

        if (keyData['type'] == 'zero-float') // if one of the floats with range 0...1
        {
            var fillCols;

            if (currentView == 'song-compare') // everything except song-compare view uses one column graph
            {
                fillCols =
                    '<div class="fill fill-1">' +
                        '<div class="value value-1"></div>' +
                    '</div>' +
                    '<div class="fill fill-2">' +
                        '<div class="value value-2"></div>' +
                    '</div>';
            }
            else
            {
                fillCols =
                    '<div class="fill">' +
                        '<div class="value"></div>' +
                    '</div>';
            }

            $('.graph-cont').append('<div class="graph-col ' + key + '">'
                + fillCols
            + '</div>');
            $('.graph-labels').append(''
            + '<div class="col-title ' + key + '">'
                + '<div class="col-icon"></div>'
                + '<span>' + keyData['name'] + '</span>'
                + '<div class="col-desc">' + keyData['description'] + '</div>'
            + '</div>');
        }
    }
}

// Sets the track1 and track2 variables
function setTrackData(data, isFeatures)
{
    var currTrack = track; //default to song mode track

    if (currentView == 'song-compare') {
        if (trackNumber == 2) {
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

// Graph the track's audio features based on the passed in audio data
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
            if (keyData['type'] == 'zero-float') {
                if (currentView == 'song-compare')
                {
                    $('.graph-col.' + key + ' .value-' + trackNumber).text(value);
                    $('.graph-col.' + key + ' .fill-' + trackNumber).css('height', value*100 + '%');
                }
                else
                {
                    $('.graph-col.' + key + ' .value').text(value);
                    $('.graph-col.' + key + ' .fill').css('height', value*100 + '%');
                }
            }
        }
    }

    if (featureData.mode == 1) // major
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
    if (currentView == 'song')
    {
        $('.non-graph-data #key').text(featureData.key);
        $('.non-graph-data #tempo').text(featureData.tempo);
        $('.non-graph-data #time_signature').text(featureData.time_signature);
        $('.non-graph-data #mode').text(featureData.mode);
        $('.non-graph-data #loudness').text(featureData.loudness);
        $('.non-graph-data #duration').text(featureData.duration);
    }

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

// Show information about the track from the passed in track data
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

    albumTarget.find('.album-image').attr('src', trackData.album.images[0].url);

    // If viewing individaul song, update title
    if (currentView == 'song')
    {
        $('.track-text #title').text(trackData.name);
        $('.track-text #artists').text('by ' + combineArtists(trackData.artists));
    }
}

// Analyzes an album, getting the audio features for the tracks on it
function handleAlbum(albumData)
{
    album = albumData;

    spotifyApi.getAudioFeaturesForTracks(getTrackIds(albumData.tracks.items)).then(analyzeAudioFeatures, spotifyError);
}

// Analyzes a playlist, getting the audio features for the tracks on it
function handlePlaylist(playlistData)
{
    playlist = playlistData;

    spotifyApi.getAudioFeaturesForTracks(getTrackIds(playlistData.tracks.items, true)).then(analyzeAudioFeatures, spotifyError);
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

    for (var key in sums)
    {
        var sum = sums[key];
        averages[key] = sum / audioFeatures.length;
    }

    // Step 3 - start to get the standard deviation by iterating through again and getting the sum of the squares of the difference of each value of the mean

    var differenceSquareSums = {}; // stores the sum of the square of the differences

    iterateThroughFeatures(true);

    // Step 4 - sqrt all of the sums to get the final standard deviation

    var standardDeviations = {};

    for (key in differenceSquareSums)
    {
        standardDeviations[key] = Math.sqrt(differenceSquareSums[key]); // std. deviation is the sqrt of the sum of the squares of the differences from the average
    }

    // Wrap up by saving the data so we don't recompute this

    if (spotifyObjectType == 'album')
    {
        albumAnalysisResults.averages = averages;
        albumAnalysisResults.standardDeviations = standardDeviations;
    }
    else if (spotifyObjectType == 'playlist')
    {
        playlistAnalysisResults.averages = averages;
        playlistAnalysisResults.standardDeviations = standardDeviations;
    }

    graphAnalysisResults(true); //and graph it all, pushing to history

    // A helper function to iterate through all features, either summing up the values, or getting differences from the average
    // Needed since the data has to be run through twice (first pass for averages, second pass for std. deviation)
    function iterateThroughFeatures(averagesCompleted)
    {
        for (var featuresKey in audioFeatures) { // iterate through each set of features (each is the audio features for one track) {
            var audioFeature = audioFeatures[featuresKey];

            for (var key in audioFeature) {
                if (key in spotifyGraphableData && spotifyGraphableData[key].type == 'zero-float') { // analyze if this data is graphable
                    var value = audioFeature[key];

                    if (averagesCompleted) {
                        if (key in differenceSquareSums)
                        {
                            differenceSquareSums[key] += Math.pow(averages[key] - value, 2);
                        }
                        else
                        {
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

function graphAnalysisResults(pushHistory)
{
    if (pushHistory) {
        pushStateToHistory();
    }

    $('.std-dev').remove(); // remove old analysis data

    var analysisResultsObj;
    $('.album-module.details h2').text('');

    if (spotifyObjectType == 'album')
    {
        if (album.images) {
            $('.album-module.details .album-image').attr('src', album.images[0].url);
            $('.album-module.details h1').text(album.name);
            $('.album-module.details h2').text('By ' + combineArtists(album.artists));
        }
        else {
            $('.album-module.details .album-image').attr('src', 'album-art-placeholder.png');
            $('.album-module.details h1').text('Find an album to get started');
        }

        analysisResultsObj = albumAnalysisResults;
    }
    else if (spotifyObjectType == 'playlist')
    {
        if (playlist.images) {
            $('.playlist-module.details .album-image').attr('src', playlist.images[0].url);
            $('.playlist-module.details h1').text(playlist.name);
        }
        else
        {
            $('.playlist-module.details .album-image').attr('src', 'album-art-placeholder.png');
            $('.playlist-module.details h1').text('Find a playlist to get started');
        }

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

// Called as a result of calling the search API call
function handleSearch(data)
{
    $('.search-results').html(''); // clear the HTML of the search results

    // Determine the objects to iterate through depending on what type of objects we are dealing with
    var items;

    if (spotifyObjectType == 'track') {
        items = data.tracks.items;
    }
    else if (spotifyObjectType == 'album') {
        items = data.albums.items;
    }
    else if (spotifyObjectType == 'playlist') {
        items = data.playlists.items;
    }

    for (var key in items) // iterate through spotify items
    {
        var spotifyObject = items[key]; //can be a track, album or playlist
        var artistsLine = ''; // by line for artists. Used only on tracks
        var images;

        if (spotifyObjectType == 'track') {
            images = spotifyObject.album.images;
            artistsLine = '<br><span class="author">by ' + combineArtists(spotifyObject.artists) + '</span>';
        }
        else {
            images = spotifyObject.images;
        }

        var idealImage = images[1] || images[0]; // try to use second image, fallback to first if only one

        $('.search-results').append('<div class="search-listing" data-uri=' + spotifyObject.uri + '>'
            + '<img src="' + idealImage.url + '">'
            + '<div class="listing-text">'
                + '<span class="track-title">' + spotifyObject.name + '</span>'
                + artistsLine
            + '</div>'
        + '</div>');
    }

    if (items.length == 0)
    {
        $('.search-results').append('<h2 id="search-no-results">No results found</h2>');
    }

    $('.search-results').slideDown();

    $('.search-listing').click(function()
    {
        clearInput();
        $('.search-results').hide();
        getSpotifyData(null, $(this).attr('data-uri'));
    });
}

// Hides the search and clears the input fields
function clearInput()
{
    $('#search-field, #spotify-id').val('');
    $('.search-results').hide();
}

/**
 * Modify the body and input-bar-cont to indicate the current view is empty
 *
 * WIP: Converting to Vue
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
function toggleRecord()
{
    var elem = $(this).find('.record'); //since album-image-cont triggers the event, find the record

    var speed = 400;

    if ($(this).hasClass('playing')) {
        hideRecord(elem, speed);
    }
    else {
        showRecord(elem, speed);
    }
}

/**
 * Show the record, playing the audioObject when the animation ends
 *
 * @param  {jQuery Object} elem  The ".record" element to animate
 * @param  {integer} speed Speed of the animation in ms
 */
function showRecord(elem, speed)
{
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
 * @param  {jQuery Object} elem  The ".record" object to animate
 * @param  {integer} speed Speed of the animation in ms
 */
function hideRecord(elem, speed)
{
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
        currentView: currentView,
        spotifyObjData: generateDataHash(),
    }, null, generateURL());

    // Generates a URL that uniquely identifies this
    function generateURL()
    {
        var url = '?';
        url += 'currView=' + currentView;

        // Push data of what Spotify objects are loaded, if they are loaded
        if (currentView == 'song' && track.trackObject) {
            url += '&track=' + track.trackObject.uri;
        }
        else if (currentView == 'song-compare'
            && track1.trackObject && track2.trackObject) { // only push song compare state with both songs defined
            url += '&track1=' + track1.trackObject.uri + '&track2=' + track2.trackObject.uri;
        }
        else if (currentView == 'album' && album.uri) {
            url += '&album=' + album.uri;
        }
        else if (currentView == 'playlist' && playlist.uri) {
            url += '&playlist=' + playlist.uri;
        }

        return url;
    }

    // Generates a hash of the currently used data for this view. Doesn't save all data
    function generateDataHash()
    {
        var hash = {};

        if (currentView == 'song') {
            hash[track] = track;
        }
        else if (currentView == 'song-compare') {
            hash[track1] = track1;
            hash[track2] = track2;
        }
        else if (currentView == 'album') {
            hash[album] = album;
        }
        else if (currentView == 'playlist') {
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
        switchView(null, params['currView']);

        if (currentView == 'song' && params['track']) {
            getSpotifyData(null, params['track']);
        }
        else if (currentView == 'song-compare' && params['track1'] && params['track2']) {
            // Load in second track data
            albumTarget = $('#track-2');
            trackNumber = 2;

            getSpotifyData(null, params['track2']);

            setTimeout(function() {
                // Load in first track data after delay. First is last so the albumTarget is consistent with default of 1
                albumTarget = $('#track-1');
                trackNumber = 1;
                getSpotifyData(null, params['track1']);
            }, 500);

        }
        else if (currentView == 'album' && params['album']) {
            getSpotifyData(null, params['album']);
        }
        else if (currentView == 'playlist' && params['playlist']) {
            getSpotifyData(null, params['playlist']);
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

    // Wait for new element to be in DOM before setting up events. This is
    // temporary while these are all in jQuery
    setTimeout(setupPostLoginEvents, 1000);

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