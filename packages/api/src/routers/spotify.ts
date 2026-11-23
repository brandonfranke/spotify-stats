import type { Page } from "@spotify/web-api-ts-sdk";
import { z } from "zod";

import { protectedProcedure } from "../index";
import type { PlaylistItem } from "../spotify";

const PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 10;
/** Spotify caps search and artist albums at 10 per request. */
const ARTIST_ALBUMS_PAGE_SIZE = 10;

const id = z.string().regex(/^[0-9A-Za-z]{22}$/, "Invalid Spotify ID");
const page = z.number().int().min(1).max(500).default(1);
const timeRange = z.enum(["short_term", "medium_term", "long_term"]).default("medium_term");
const offset = (page: number, size: number = PAGE_SIZE) => (page - 1) * size;

export const spotifyRouter = {
  profile: protectedProcedure.handler(({ context }) => context.spotify.currentUser.profile()),

  top: {
    tracks: protectedProcedure
      .input(z.object({ timeRange, page }))
      .handler(({ context, input }) =>
        context.spotify.currentUser.topItems("tracks", input.timeRange, PAGE_SIZE, offset(input.page)),
      ),
    artists: protectedProcedure
      .input(z.object({ timeRange, page }))
      .handler(({ context, input }) =>
        context.spotify.currentUser.topItems("artists", input.timeRange, PAGE_SIZE, offset(input.page)),
      ),
  },

  recent: protectedProcedure.handler(({ context }) => context.spotify.player.getRecentlyPlayedTracks(50)),

  library: {
    tracks: protectedProcedure
      .input(z.object({ page }))
      .handler(({ context, input }) =>
        context.spotify.currentUser.tracks.savedTracks(PAGE_SIZE, offset(input.page)),
      ),
    albums: protectedProcedure
      .input(z.object({ page }))
      .handler(({ context, input }) =>
        context.spotify.currentUser.albums.savedAlbums(PAGE_SIZE, offset(input.page)),
      ),
    artists: protectedProcedure
      .input(z.object({ after: id.optional() }))
      .handler(({ context, input }) =>
        context.spotify.currentUser.followedArtists(input.after, PAGE_SIZE),
      ),
    playlists: protectedProcedure
      .input(z.object({ page }))
      .handler(({ context, input }) =>
        context.spotify.currentUser.playlists.playlists(PAGE_SIZE, offset(input.page)),
      ),
  },

  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(1).max(200), page: page.pipe(z.number().max(100)) }))
    .handler(({ context, input }) =>
      context.spotify.search(
        input.query,
        ["track", "artist", "album"],
        undefined,
        SEARCH_PAGE_SIZE,
        offset(input.page, SEARCH_PAGE_SIZE),
      ),
    ),

  track: protectedProcedure
    .input(z.object({ id }))
    .handler(({ context, input }) => context.spotify.tracks.get(input.id)),

  artist: {
    get: protectedProcedure
      .input(z.object({ id }))
      .handler(({ context, input }) => context.spotify.artists.get(input.id)),
    albums: protectedProcedure
      .input(z.object({ id, page }))
      .handler(({ context, input }) =>
        context.spotify.artists.albums(
          input.id,
          undefined,
          undefined,
          ARTIST_ALBUMS_PAGE_SIZE,
          offset(input.page, ARTIST_ALBUMS_PAGE_SIZE),
        ),
      ),
  },

  album: {
    get: protectedProcedure
      .input(z.object({ id }))
      .handler(({ context, input }) => context.spotify.albums.get(input.id)),
    tracks: protectedProcedure
      .input(z.object({ id, page }))
      .handler(({ context, input }) =>
        context.spotify.albums.tracks(input.id, undefined, PAGE_SIZE, offset(input.page)),
      ),
  },

  playlist: {
    get: protectedProcedure
      .input(z.object({ id }))
      .handler(({ context, input }) => context.spotify.playlists.getPlaylist(input.id)),
    // The SDK still calls the removed `/tracks` endpoint, so request `/items` directly.
    items: protectedProcedure
      .input(z.object({ id, page }))
      .handler(({ context, input }) =>
        context.spotify.makeRequest<Page<PlaylistItem>>(
          "GET",
          `playlists/${input.id}/items?limit=${PAGE_SIZE}&offset=${offset(input.page)}`,
        ),
      ),
  },

  player: {
    // Resolves to null (HTTP 204) when nothing is playing.
    state: protectedProcedure.handler(({ context }) =>
      context.spotify.player.getPlaybackState(undefined, "episode"),
    ),
    queue: protectedProcedure.handler(({ context }) => context.spotify.player.getUsersQueue()),
    play: protectedProcedure
      .input(z.object({ deviceId: z.string() }))
      .handler(({ context, input }) => context.spotify.player.startResumePlayback(input.deviceId)),
    pause: protectedProcedure
      .input(z.object({ deviceId: z.string() }))
      .handler(({ context, input }) => context.spotify.player.pausePlayback(input.deviceId)),
    next: protectedProcedure
      .input(z.object({ deviceId: z.string() }))
      .handler(({ context, input }) => context.spotify.player.skipToNext(input.deviceId)),
    previous: protectedProcedure
      .input(z.object({ deviceId: z.string() }))
      .handler(({ context, input }) => context.spotify.player.skipToPrevious(input.deviceId)),
  },
};
