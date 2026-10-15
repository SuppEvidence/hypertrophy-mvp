/** Browser normalization removes original EXIF/location metadata and bounds request size. Server repeats normalization. */
export async function preparePhysiquePhoto(file:File):Promise<Blob>{
  if(!file.type.startsWith("image/"))throw new Error("Choose an image file.");
  if(file.size>25000000)throw new Error("Choose a photo smaller than 25 MB.");
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    const scale=Math.min(1,960/image.naturalWidth,1280/image.naturalHeight);
    const canvas=document.createElement("canvas");canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    const context=canvas.getContext("2d");if(!context)throw new Error("Image preparation unavailable.");
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Photo could not be prepared.")),"image/jpeg",0.85));
    if(blob.size>1000000)throw new Error("Photo remains too large. Choose a smaller image.");return blob;
  }finally{URL.revokeObjectURL(url);}
}
