import { requireUserId } from "@/lib/auth/user";
import { readPhysiquePhoto } from "@/lib/server/physique-checkins";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{checkinId:string;photoId:string}>}){
  try {const userId=await requireUserId();const {checkinId,photoId}=await params;
    const bytes=await readPhysiquePhoto(userId,checkinId,photoId);
    return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
  }catch{return new Response("Photo unavailable",{status:404,headers:{"Cache-Control":"private, no-store"}});}
}
