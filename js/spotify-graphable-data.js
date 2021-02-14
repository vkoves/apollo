/**
 * Make sure ESLint knows we are exporting spotifyGraphableData for use
 * apollo.js
 */
/* exported spotifyGraphableData */

// Mostly pulled from https://developer.spotify.com/web-api/get-audio-features/
var spotifyGraphableData = {
    'acousticness' : {
        'name': 'Acousticness',
        'description': 'A confidence measure from 0.0 to 1.0 of whether the track is acoustic. 1.0 represents high confidence the track is acoustic.',
        'type': 'zero-float'
    },
    'danceability': {
        'name': 'Danceability',
        'description': 'Danceability describes how suitable a track is for dancing based on a combination of musical elements including tempo, rhythm stability, beat strength, and overall regularity. A value of 0.0 is least danceable and 1.0 is most danceable.',
        'type': 'zero-float'
    },
    'energy': {
        'name': 'Energy',
        'description': 'Energy is a measure from 0.0 to 1.0 and represents a perceptual measure of intensity and activity. Typically, energetic tracks feel fast, loud, and noisy. For example, death metal has high energy, while a Bach prelude scores low on the scale. Perceptual features contributing to this attribute include dynamic range, perceived loudness, timbre, onset rate, and general entropy.',
        'type': 'zero-float'
    },
    'instrumentalness': {
        'name': 'Instrumentalness',
        'description': 'Predicts whether a track contains no vocals. "Ooh" and "aah" sounds are treated as instrumental in this context. Rap or spoken word tracks are clearly "vocal". The closer the instrumentalness value is to 1.0, the greater likelihood the track contains no vocal content. Values above 0.5 are intended to represent instrumental tracks, but confidence is higher as the value approaches 1.0.',
        'type': 'zero-float'
    },
    'liveness': {
        'name': 'Liveness',
        'description': 'Detects the presence of an audience in the recording. Higher liveness values represent an increased probability that the track was performed live. A value above 0.8 provides strong likelihood that the track is live.',
        'type': 'zero-float'
    },
    'speechiness': {
        'name': 'Speechiness',
        'description': 'Speechiness detects the presence of spoken words in a track. The more exclusively speech-like the recording (e.g. talk show, audio book, poetry), the closer to 1.0 the attribute value. Values above 0.66 describe tracks that are probably made entirely of spoken words. Values between 0.33 and 0.66 describe tracks that may contain both music and speech, either in sections or layered, including such cases as rap music. Values below 0.33 most likely represent music and other non-speech-like tracks.',
        'type': 'zero-float'
    },
    'valence': {
        'name': 'Valence',
        'description': 'A measure from 0.0 to 1.0 describing the musical positiveness conveyed by a track. Tracks with high valence sound more positive (e.g. happy, cheerful, euphoric), while tracks with low valence sound more negative (e.g. sad, depressed, angry).',
        'type': 'zero-float'
    },


    'key': {
        'name': 'Key',
        'description': 'The key the track is in. Integers map to pitches using standard Pitch Class notation. E.g. 0 = C, 1 = C♯/D♭, 2 = D, and so on.'
    },
    'mode': {
        'name': 'Mode',
        'description': 'Mode indicates the modality (major or minor) of a track, the type of scale from which its melodic content is derived. Major is represented by 1 and minor is 0.'
    },
    'tempo': {
        'name': 'Tempo',
        'description': 'The overall estimated tempo of a track in beats per minute (BPM). In musical terminology, tempo is the speed or pace of a given piece and derives directly from the average beat duration.'
    },
    'time_signature': {
        'name': 'Time Signature',
        'description': 'An estimated overall time signature of a track. The time signature (meter) is a notational convention to specify how many beats are in each bar (or measure).'
    }
};
