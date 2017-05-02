<img src="logo.png?raw=true" align="right" width="100">

# Apollo

Apollo is a music analysis tool powered by the Spotify API that lets you better understand your favorite songs. It allows users to retrieve internally stored Spotify song data, including rankings such as the energy or acousticness of a song. Apollo can also run on a playlist or album and calculate averages and standard deviations for these values across the set of songs contained within.

Special thanks to Spotify for having such a wonderful and well documented API.

## Technology
Apollo is powered by [Jekyll](https://jekyllrb.com/) and is hosted on [GitHub Pages](https://pages.github.com/) via Viktor's Website.

To run Apollo locally, clone it and then run `jekyll serve`. If Jekyll is correctly configured, Apollo should be available at `localhost:4000`.

It also connects to the Spotify Web API using jQuery, which you can learn about [here](https://developer.spotify.com/web-api/).

## Spotify Rules
Apollo is only possible due to the Spotify API, which means it follows a few guidelines they set out. In particular, Apollo adheres to:
- [The Spotify Developer Terms of Use](https://developer.spotify.com/developer-terms-of-use/)
- [The Spotify Design Guide](https://developer.spotify.com/design/)

Specifically these require proper use of the Spotify logo, making sure it is clear Apollo is powered by but not affiliated with Spotify, and making sure album art is not cropped or obscured (but is shown in original form).

## Contributing
Want to help improve Apollo? Open an issue for a feature you want or a bug you have spotted, or fork the repository and help develop Apollo yourself.
