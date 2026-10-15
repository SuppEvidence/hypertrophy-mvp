import { PageHeader } from "@/components/ui/PageHeader";
import { PhysiqueCheckins } from "@/components/physique/PhysiqueCheckins";
export default async function PhysiquePage({searchParams}:{searchParams:Promise<{date?:string}>}){
  const params=await searchParams;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Helsinki",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  return <div className="space-y-5"><PageHeader title="Physique check-ins" description="Dated photos, measurements and visual coaching history."/><PhysiqueCheckins initialDate={/^\d{4}-\d{2}-\d{2}$/.test(params.date??"")?params.date!:today}/></div>;
}
