import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/user";
import { getPhysiquePageData, savePhysiqueSettings, savePhysiqueCheckin, uploadPhysiquePhoto, deletePhysiquePhoto,
  analyzePhysiqueCheckin, reviewPhysiqueAnalysis } from "@/lib/server/physique-checkins";
export const runtime="nodejs";
export const maxDuration=300;
function fail(error: unknown) {
  const message=error instanceof Error?error.message:"";
  const safe=/^(Photo |Check-in |Choose |A photo |Add at least |Use a photo |Restore |Photo dates)/.test(message);
  return NextResponse.json({error:safe?message:"Photo check-in failed. Your saved data remains available; reload and try again."},{status:safe&&/changed|running|outdated/.test(message)?409:400});
}
export async function GET(request: NextRequest) {
  try {const userId=await requireUserId();const date=request.nextUrl.searchParams.get("date")??new Date().toISOString().slice(0,10);
    return NextResponse.json(await getPhysiquePageData(userId,date),{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return fail(error);}
}
export async function POST(request: NextRequest) {
  if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"Invalid origin."},{status:403});
  try {
    const userId=await requireUserId();const reader=request.body?.getReader();if(!reader)throw new Error("Missing request");
    const chunks:Uint8Array[]=[];let total=0;
    while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>1200000){await reader.cancel();return NextResponse.json({error:"Photo request is too large."},{status:413});}chunks.push(value);}
    const bytes=new Uint8Array(Buffer.concat(chunks));
    if(request.headers.get("content-type")?.startsWith("multipart/form-data")){
      const form=await new Response(bytes,{headers:{"Content-Type":request.headers.get("content-type")!}}).formData();
      const file=form.get("photo");if(!(file instanceof File))throw new Error("Photo is missing.");
      await uploadPhysiquePhoto(userId,z.string().uuid().parse(form.get("id")),z.coerce.number().int().nonnegative().parse(form.get("revision")),String(form.get("view")),file);
    }else{
      const input=z.object({operation:z.enum(["SAVE","SETTINGS","ANALYZE","ACCEPT","DISCARD","DELETE_PHOTO"]),
        id:z.string().uuid().optional(),revision:z.number().int().nonnegative().optional(),comparisonId:z.string().uuid().nullable().optional(),photoId:z.string().uuid().optional(),data:z.unknown().optional()}).parse(JSON.parse(Buffer.from(bytes).toString("utf8")));
      if(input.operation==="SAVE"){const result=await savePhysiqueCheckin(userId,input.data);revalidatePath("/physique");return NextResponse.json(result);}
      if(input.operation==="SETTINGS")await savePhysiqueSettings(userId,input.data);
      else{const id=z.string().uuid().parse(input.id);const revision=z.number().int().nonnegative().parse(input.revision);
        if(input.operation==="ANALYZE")await analyzePhysiqueCheckin(userId,id,revision,input.comparisonId);
        else if(input.operation==="DELETE_PHOTO")await deletePhysiquePhoto(userId,id,revision,z.string().uuid().parse(input.photoId));
        else await reviewPhysiqueAnalysis(userId,id,revision,input.operation==="ACCEPT");
      }
    }
    revalidatePath("/physique");revalidatePath("/metrics");return NextResponse.json({ok:true});
  }catch(error){return fail(error);}
}
