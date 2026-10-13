/* Runtime fills a clean, artifact-tool-authored Excel style template. No uploads. */
(function (root) {
  "use strict";
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const enc = new TextEncoder();
  const xml = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function col(n) { let s = ""; while (n) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; }
  const serial = (s) => PaidproScheduler.dateNumber(s) + 25569;
  const crcTable = Array.from({ length: 256 }, (_, n) => { for (let k=0;k<8;k++) n=(n&1)?0xedb88320^(n>>>1):n>>>1; return n>>>0; });
  function crc(bytes) { let n=0xffffffff; for (const b of bytes) n=crcTable[(n^b)&255]^(n>>>8); return (n^0xffffffff)>>>0; }
  // Standard uncompressed ZIP keeps the export self-contained without a CDN/runtime.
  function zip(parts) {
    const local=[], central=[]; let offset=0;
    Object.entries(parts).forEach(([path, text]) => {
      const name=enc.encode(path), data=enc.encode(text), sum=crc(data);
      const header=new Uint8Array(30+name.length), h=new DataView(header.buffer);
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,sum,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);header.set(name,30);
      const directory=new Uint8Array(46+name.length), d=new DataView(directory.buffer);
      d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,sum,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);
      local.push(header,data);central.push(directory);offset+=header.length+data.length;
    });
    const size=central.reduce((s,b)=>s+b.length,0), end=new Uint8Array(22), e=new DataView(end.buffer);
    e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
    return new Blob([...local,...central,end],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }
  function build(schedule, settings, template) {
    const styles=template.styles, rows=[], merges=["A2:I2","A4:I4"];
    const c=(address,value,style="text",formula=null)=>`<c r="${address}" s="${styles[style]}"${value!==null&&typeof value!=="number"&&formula===null?' t="inlineStr"':''}>${formula!==null?`<f>${xml(formula)}</f><v>${value}</v>`:typeof value==="number"?`<v>${value}</v>`:value===null?"":`<is><t xml:space="preserve">${xml(value)}</t></is>`}</c>`;
    const row=(r,cells,height=24)=>rows.push(`<row r="${r}" ht="${height}" customHeight="1">${cells.join("")}</row>`);
    const last=7+schedule.tasks.length, lastCol=col(9+schedule.days.length), num=(n)=>Math.round(n*100)/100;
    row(2,[c("A2","PAIDPRO · Task Schedule","title")],30);
    row(3,[c("A3","Plan from","label"),c("B3",serial(schedule.start),"inputDate"),c("C3","Normal hr/day","label"),c("D3",settings.regular,"inputNumber"),c("E3","Max extra hr/day","label"),c("F3",settings.overtime,"inputNumber"),c("G3","Required extra hr","label"),c("H3",schedule.requiredOvertime,"metric"),c("I3","Single-person plan","label")]);
    row(4,[c("A4","Decision matrix: working days to deadline, priority and remaining hours/day. Finish each task before the next. Blue = normal, amber = overtime, rose = late. Snapshot: reschedule on the website.","note")],34);
    const weekCells=[c("A5","Planned extra hr","label"),c("B5",num(schedule.plannedOvertime),"metric",`SUM(H8:H${last})`),c("C5","At-risk tasks","label"),c("D5",schedule.lateCount,"metric"),c("E5","Unplanned hr","label"),c("F5",num(schedule.unplannedHours),"metric")];
    for(let i=0;i<schedule.days.length;) {
      const from=i, first=schedule.days[i].date, weekday=new Date(`${first}T00:00:00Z`).getUTCDay(), count=Math.min(schedule.days.length-i,7-((weekday+6)%7));
      const end=i+count-1; if(end>from) merges.push(`${col(from+10)}5:${col(end+10)}5`);
      weekCells.push(c(`${col(from+10)}5`,serial(first),"week"));i+=count;
    }
    row(5,weekCells);
    const headings=["Task","Description","Priority","Due date",schedule.tasks.some(t=>Number.isFinite(t.estimatedHours))?"Remaining hr":"Est. hours","Start","Finish","OT hours","Result"];
    row(6,[...headings.map((v,i)=>c(`${col(i+1)}6`,v,"header")),...schedule.days.map((d,i)=>c(`${col(i+10)}6`,serial(d.date),"dateHeader"))],30);
    row(7,schedule.days.map((d,i)=>c(`${col(i+10)}7`,new Intl.DateTimeFormat("en-US",{weekday:"short",timeZone:"UTC"}).format(new Date(`${d.date}T00:00:00Z`)),"weekday")));
    schedule.tasks.forEach((t,i)=>{
      const r=i+8, map=new Map(t.allocations.map(a=>[a.date,a]));
      const cells=[c(`A${r}`,t.name),c(`B${r}`,t.description),c(`C${r}`,t.priority[0].toUpperCase()+t.priority.slice(1)),c(`D${r}`,serial(t.due),"date"),c(`E${r}`,t.hours,"number"),c(`F${r}`,t.start?serial(t.start):null,"date"),c(`G${r}`,t.finish?serial(t.finish):null,"date"),c(`H${r}`,num(t.overtimeHours),"number"),c(`I${r}`,t.status,t.shortageHours||t.unplannedHours?"risk":"text")];
      schedule.days.forEach((d,j)=>{const a=map.get(d.date); if(a||!d.working) cells.push(c(`${col(j+10)}${r}`,a?num(a.regular+a.overtime):null,a?(d.date>t.due?"late":a.overtime?"overtime":"normal"):"off"));});
      row(r,cells,Math.max(38,Math.min(409,Math.ceil(Math.max(t.name.length/24,t.description.length/32))*13)));
    });
    const footer=last+2;
    const totals=[['Total hours planned','totalNumber'],['Normal hours planned','totalNumber'],['Overtime planned','warningNumber'],['Normal capacity','capacity'],['Extra hours limit','capacity']];
    totals.forEach(([label,style],i)=>{
      const r=footer+i;merges.push(`A${r}:I${r}`);
      row(r,[c(`A${r}`,label,"totalLabel"),...schedule.days.map((d,j)=>{
        const column=col(j+10);
        const value=i===0?num(d.regular+d.overtime):i===1?d.regular:i===2?d.overtime:i===3?d.regularCapacity:d.overtimeCapacity;
        const f=i===0?`SUM(${column}8:${column}${last})`:i===2?`${column}${footer}-${column}${footer+1}`:null;
        return c(`${column}${r}`,value,style,f);
      })]);
    });
    const widths=[26,32,14,16,14,16,16,12,26];
    const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}"><dimension ref="A1:${lastCol}${footer+4}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="9" ySplit="7" topLeftCell="J8" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}<col min="10" max="${schedule.days.length+9}" width="8" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join("")}</mergeCells><conditionalFormatting sqref="J6:${lastCol}7"><cfRule type="expression" dxfId="0" priority="1"><formula>J$6=TODAY()</formula></cfRule></conditionalFormatting><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape"/></worksheet>`;
    // Highlight today using a differential style; do not depend on a stale export date.
    const styleXml=template.stylesXml.replace(/<dxfs\s+count="0"\s*\/>/, '<dxfs count="1"><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFFFE2A8"/><bgColor indexed="64"/></patternFill></fill></dxf></dxfs>');
    const relns="http://schemas.openxmlformats.org/package/2006/relationships";
    return zip({
      "[Content_Types].xml":`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`,
      "_rels/.rels":`<?xml version="1.0"?><Relationships xmlns="${relns}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml":`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Schedule" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
      "xl/_rels/workbook.xml.rels":`<?xml version="1.0"?><Relationships xmlns="${relns}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>`,
      "xl/styles.xml":styleXml,"xl/theme/theme1.xml":template.themeXml,"xl/worksheets/sheet1.xml":sheet
    });
  }
  let templatePromise;
  async function download(schedule,settings) {
    if(!templatePromise) templatePromise=fetch("task-export-template.json").then(r=>{if(!r.ok) throw Error("Template unavailable");return r.json();}).catch(e=>{templatePromise=null;throw e;});
    const blob=build(schedule,settings,await templatePromise),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`PAIDPRO-Task-Schedule-${schedule.start}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  root.PaidproExport={download,build};
})(globalThis);
