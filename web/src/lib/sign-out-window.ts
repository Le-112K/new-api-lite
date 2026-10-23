/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * Sign-out teardown window.
 *
 * While a logout is in flight, requests that were already on the wire come
 * back unauthorised after the user chose to leave. Those 401s are expected
 * noise: each one used to surface its own toast (directly from the response
 * interceptor, and again from the query/mutation caches), stacking several
 * contradictory "session expired" cards on top of the single "signed out"
 * message. Both layers consult this window and stay silent.
 *
 * The window expires on its own so an abandoned sign-out cannot mute the app
 * indefinitely; the success path may leave it to run out, and failure paths
 * close it immediately so normal error reporting resumes.
 */
let signOutWindowUntil = 0

const DEFAULT_SIGN_OUT_WINDOW_MS = 10_000

export function beginSignOutWindow(
  durationMs = DEFAULT_SIGN_OUT_WINDOW_MS
): void {
  signOutWindowUntil = Date.now() + durationMs
}

export function endSignOutWindow(): void {
  signOutWindowUntil = 0
}

export function isSignOutWindowActive(): boolean {
  return Date.now() < signOutWindowUntil
}
