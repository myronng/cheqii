import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			safeGetSession: () => Promise<{ session: null | Session; user: null | User }>;
			session: null | Session;
			supabase: SupabaseClient<Database>;
			user: null | User;
		}
		interface PageData {
			session: null | Session;
		}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		google: any;
	}
}
