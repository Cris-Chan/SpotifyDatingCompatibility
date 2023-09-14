"use client";
import axios from "axios";
import querystring from "querystring";

const client_id = process.env.NEXT_PUBLIC_CLIENT_ID;
const client_secret = process.env.NEXT_PUBLIC_CLIENT_SECRET;
const redirect_uri = "http://localhost:3000/calculatePage";
const scope = "user-read-private user-read-email";

// Function to initiate the OAuth process and redirect the user, returns promise
export const initiateSpotifyLogin = (string) => {
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

    // Open the Spotify login page in a new window
    const authWindow = window.open(
      `https://accounts.spotify.com/authorize?${queryParams}`
    );

    // Listen for a message from the authWindow
    window.addEventListener("message", (event) => {
      // Check if the message came from the authWindow
      if (event.source === authWindow) {
        // Check if the state matches the one we saved earlier
        if (event.data.state === sessionStorage.getItem("spotify_auth_state")) {
          // The login was successful, resolve the promise
          resolve(true);
        } else {
          // The state didn't match, reject the promise
          reject(new Error("State mismatch"));
        }
      }
    });
  });
};

// Function to generate a random string for the OAuth state parameter
const generateRandomString = (length) => {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};

// Function to exchange the authorization code for an access token
export const getAccessToken = async (code) => {
  console.log("getAccessTokenFunc: code->", code);

  const params = new URLSearchParams();
  params.append("code", code);
  params.append("redirect_uri", redirect_uri);
  params.append("grant_type", "authorization_code");

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(client_id + ":" + client_secret).toString("base64"),
      },
      body: params,
    });

    const data = await response.json();
    console.log("spotify data: ", data);
    return data; // This will contain your access token
  } catch (error) {
    console.error("Error fetching access token", error);
  }
};

// get and return formatted user data into a concise profil
// scope needed - user-top-read,
export const fetchUserData = (token) => {
  // need the following:
  /*
   * top 20 artists
   * top 20 tracks
  this should be all we need to make more calls for more data, and calculations
   */
};

export const calculateListeningProfile = (personData) => {
  // return an array of what we have (top artists, topTracks)
  // calculate list of all covered genres based on artists and tracks,
  // gather vector of audio features from all top songs, calculate average of all to hold in a single vector for the user profile
};

// return the compatibility score (0-100)
export const calculateCompatible = (personProfile1, personProfile2) => {
  // we need to calculate the following factors
  /*
    *  Audio feature similarity - 50 points total
      - Calculate cosine similarity of audio feature vectors (higher = more compatible)
    *  Artist overlap - 10 points
      - calculate the percent overlap in all artist genres
    *  Genre overlap - 40 points
      - calculate percent overlap of genre array
    
  */
};
