"use client";
import axios from "axios";
import querystring from "querystring";

const client_id = process.env.NEXT_PUBLIC_CLIENT_ID;
const client_secret = process.env.NEXT_PUBLIC_CLIENT_SECRET;
const redirect_uri = process.env.NEXT_PUBLIC_REDIRECT_URL;
const scope = "user-read-private user-read-email user-top-read";

// Function to initiate the OAuth process and redirect the user, returns promise
export const initiateSpotifyLogin = (string) => {
  if (!string) {
    throw new Error("Invalid redirect URI");
  }
  return new Promise((resolve, reject) => {
    // Generate the state and save it in the session storage
    const state = generateRandomString(16);
    sessionStorage.setItem("spotify_auth_state", state);

    const queryParams = querystring.stringify({
      response_type: "code",
      client_id,
      scope,
      redirect_uri: string ? string : redirect_uri,
      state,
    });

    // Navigate to the Spotify login page in the same window
    window.location.href = `https://accounts.spotify.com/authorize?${queryParams}`;
  });
};

//!! Internal function
// Function to generate a random string for the OAuth state parameter
const generateRandomString = (length) => {
  if (!length) {
    throw new Error("Invalid length for random string");
  }
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};

export const getAccessToken = async (code, redirect_uri) => {
  if (!code || !redirect_uri) {
    throw new Error("Invalid code or redirect URI");
  }
  const form = {
    code: code,
    redirect_uri: redirect_uri,
    grant_type: "authorization_code",
  };
  const headers = {
    Authorization:
      "Basic " +
      new Buffer.from(client_id + ":" + client_secret).toString("base64"),
  };

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify(form),
      { headers }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting access token: ", error);
    throw error;
  }
};

/**
 * Fetches user data from Spotify API.
 *
 * @param {string} token - The access token for the Spotify API.
 * @returns {Promise<Object>} A promise that resolves to an object containing user data:
 * - name: The user's display name.
 * - topArtists: An array of the user's top artists, each represented as an object with properties 'name', 'id', and 'popularity'.
 * - topSongs: An array of the user's top songs, each represented as an object with properties 'name', 'id', and 'popularity'.
 * - genres: An array of unique genres associated with the user's top artists.
 * - topRelatedArtists: An array of artists related to the user's top artists.
 * @throws {Error} If the token is invalid or if there is an error fetching the data.
 */

export const fetchUserData = async (token) => {
  if (!token) {
    throw new Error("Invalid token");
  }
  try {
    const profileResponse = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const topArtistResponse = await axios.get(
      "https://api.spotify.com/v1/me/top/artists?time_range=long_term&limit=4",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const topSongsResponse = await axios.get(
      "https://api.spotify.com/v1/me/top/tracks?time_range=long_term",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const genres = Array.from(
      new Set(topArtistResponse.data.items.flatMap((artist) => artist.genres))
    );
    const name = profileResponse.data.display_name;
    const topArtists = topArtistResponse.data.items.map((artist) => ({
      name: artist.name,
      id: artist.id,
      popularity: artist.popularity,
    }));
    const topRelatedArtistsNested = await Promise.all(
      topArtists.map((artistObj) => fetchRelatedArtists(artistObj.id, token))
    );
    const topRelatedArtists = Array.from(
      new Set(topRelatedArtistsNested.flat())
    );
    const topSongs = topSongsResponse.data.items.map((song) => ({
      name: song.name,
      id: song.id,
      popularity: song.popularity,
    }));

    console.log("DATA AQUIRED: ", name, topArtists, topSongs, genres);
    return { name, topArtists, topSongs, genres, topRelatedArtists };
  } catch (error) {
    console.error("Error fetching user data: ", error);
    throw error;
  }
};

const fetchRelatedArtists = async (artistId, accessToken) => {
  if (!artistId || !accessToken) {
    throw new Error("Invalid artistId or accessToken");
  }
  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${artistId}/related-artists`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const relatedArtists = response.data.artists.map((artist) => artist.name);
    return relatedArtists;
  } catch (error) {
    console.error("Error fetching related artists: ", error);
    throw error;
  }
};

/**
 * Calculates a similarity score based on the overlap between a user's top artists and a buddy's related artists.
 *
 * @param {Array<string>} topArtists - The user's top artists.
 * @param {Array<string>} relatedArtists - The buddy's related artists.
 * @returns {number} A score between 0 and 100 representing the percentage of the user's top artists that are also in the buddy's related artists.
 * @throws {Error} If the input arrays are not valid.
 */
export const calculateArtistOverlapScore = (topArtists, relatedArtists) => {
  if (!Array.isArray(topArtists) || !Array.isArray(relatedArtists)) {
    console.error(
      "Invalid input: both topArtists and relatedArtists must be arrays."
    );
    return 0;
  }

  if (topArtists.length === 0 || relatedArtists.length === 0) {
    console.error(
      "Invalid input: both topArtists and relatedArtists must not be empty."
    );
    return 0;
  }

  const overlap = topArtists.filter((artist) =>
    relatedArtists.includes(artist)
  );
  const score = (overlap.length / topArtists.length) * 100;

  return score;
};

export const getEmbeddings = async (genreArray) => {
  if (!genreArray || !Array.isArray(genreArray)) {
    throw new Error("Invalid genre array");
  }
  console.log("embeddings soon to be's : " + genreArray);
  const headers = {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_KEY}`,
    "Content-Type": "application/json",
  };

  const requests = genreArray.map((genre) => {
    const data = {
      input: genre,
      model: "text-embedding-ada-002",
    };

    return axios.post("https://api.openai.com/v1/embeddings", data, {
      headers,
    });
  });

  try {
    const responses = await Promise.all(requests);
    return responses.map((response) => response.data.data[0].embedding);
  } catch (error) {
    console.error(error);
    //!!HERE
    throw error;
  }
};

export const calculateSumEmbedding = (embeddings) => {
  // Ensure that the embeddings array is in the correct format
  if (!Array.isArray(embeddings) || !embeddings.every(Array.isArray)) {
    throw new Error(
      "Invalid format for embeddings. Expected an array of arrays."
    );
  }

  // If embeddings is an empty array, return an empty array
  if (embeddings.length === 0) {
    return [];
  }

  const sum = embeddings.reduce((acc, curr) => {
    // Ensure that each embedding is of the correct length
    if (curr.length !== 1536) {
      throw new Error(
        "Invalid format for individual embedding. Expected an array of length 1536."
      );
    }

    return acc.map((num, idx) => num + curr[idx]);
  }, new Array(embeddings[0].length).fill(0));

  return sum;
};
export const calculateCompatibilityScore = (embeddings1, embeddings2) => {
  // Ensure that the embeddings arrays are in the correct format
  if (
    !Array.isArray(embeddings1) ||
    !embeddings1.every(Array.isArray) ||
    !Array.isArray(embeddings2) ||
    !embeddings2.every(Array.isArray)
  ) {
    throw new Error(
      "Invalid format for embeddings. Expected an array of arrays."
    );
  }

  // Ensure that each embedding is of the correct length
  if (embeddings1[0].length !== 1536 || embeddings2[0].length !== 1536) {
    throw new Error(
      "Invalid format for individual embedding. Expected an array of length 1536."
    );
  }

  // Calculate the dot product of the two embeddings
  let dotProduct = 0;
  for (let i = 0; i < embeddings1[0].length; i++) {
    dotProduct += embeddings1[0][i] * embeddings2[0][i];
  }

  // Calculate the magnitude of the two embeddings
  let magnitude1 = 0;
  let magnitude2 = 0;
  for (let i = 0; i < embeddings1[0].length; i++) {
    magnitude1 += embeddings1[0][i] * embeddings1[0][i];
    magnitude2 += embeddings2[0][i] * embeddings2[0][i];
  }
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  // Calculate the cosine similarity and scale it to a score between 1 and 100
  const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
  const score = Math.round(cosineSimilarity * 100); // scale from 0-1 to 1-100 and round to the nearest whole number

  return score;
};
