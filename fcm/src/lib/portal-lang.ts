import { cookies } from 'next/headers'
export async function portalLang() { return (await cookies()).get('fcm_lang')?.value === 'ko' ? 'ko' : 'en' }
