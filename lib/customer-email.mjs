// Transactional customer messages only. No marketing, tracking or client-side keys.
export function customerEmailEnabled(env) {
  return Boolean(env.RESEND_API_KEY && /^[^\r\n]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(env.CUSTOMER_EMAIL_FROM || ''));
}

export function customerMessage(mail) {
  const d=mail.data, booking=mail.kind==='booking', confirmed=mail.event==='confirmed';
  const date=new Intl.DateTimeFormat('sv-SE',{dateStyle:'full',timeZone:'UTC'}).format(new Date(d.date+'T12:00:00Z'));
  const title=confirmed ? (booking?'Din bordsbokning är bekräftad':'Din beställning för avhämtning är bekräftad') : (booking?'Vi har tagit emot din bordsförfrågan':'Vi har tagit emot din beställningsförfrågan');
  const introduction=confirmed ? (booking?'Vi ser fram emot ditt besök!':'Vi bekräftar din beställning för avhämtning. Du betalar på plats.') : 'Detta är ett mottagningsbesked. Förfrågan är ännu inte bekräftad. Restaurangen återkommer med ett separat besked om plats och tid.';
  const details=booking ? `${d.guests} gäster` : d.items.map(x=>`${x.quantity} × ${x.name} — ${new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK'}).format(x.quantity*x.price/100)}`).join('\n')+`\n\nSumma: ${new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK'}).format(d.total/100)}\nBetalas på plats.`;
  return {
    subject:`La Gustosa – ${title.toLocaleLowerCase('sv-SE')}`,
    text:`Hej ${d.name}!\n\n${introduction}\n\n${date}, kl. ${d.time}\n${details}\n\nReferens: ${mail.request_id.slice(0,8).toUpperCase()}\n\nLa Gustosa\nSandwallsplats 7, Borås\nTelefon: 072-993 99 93\n\nHar du frågor eller behöver ändra något? Svara på detta mejl eller ring oss.\n\nVälkommen!\nLa Gustosa`,
  };
}

export function createCustomerMailer({env,db,fetchImpl=fetch}) {
  const enabled=customerEmailEnabled(env);
  const summary=async ids=>{
    if(!enabled)return {enabled:false,ready:false,rows:[]};
    if(!ids.length)return {enabled:true,ready:true,rows:[]};
    try {
      const rows=await db(`lg_customer_mail?request_id=in.(${ids.join(',')})&select=id,request_id,event,state,created_at&order=created_at.desc`);
      return {enabled:true,ready:true,rows};
    } catch { return {enabled:true,ready:false,rows:[]}; }
  };
  const send=async(requestId,event=null)=>{
    if(!enabled)return 'disabled';
    let mail;
    try {
      const claimed=await db('rpc/lg_claim_customer_mail',{method:'POST',body:JSON.stringify({target_request:requestId,target_event:event})});
      mail=claimed[0];
      if(!mail)return 'unchanged';
    } catch { return 'setup_required'; }
    let state='uncertain',providerId=null;
    try {
      // The frozen request snapshot and sender make retries byte-for-byte stable.
      let payload=mail.payload;
      if(!payload) {
        payload={from:env.CUSTOMER_EMAIL_FROM,to:[mail.data.email],reply_to:env.CUSTOMER_EMAIL_REPLY_TO || 'ayush.giri2006@gmail.com',...customerMessage(mail)};
        await db(`lg_customer_mail?id=eq.${mail.id}&state=eq.sending`,{method:'PATCH',body:JSON.stringify({payload})});
      }
      const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`lagustosa/${mail.id}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
      const result=await response.json();
      if(response.ok && typeof result.id==='string') {state='accepted';providerId=result.id;}
      else state=response.status>=500 || response.status===409 ? 'uncertain' : 'failed';
    } catch { /* Delivery may have happened; retry with the same key only within its safe window. */ }
    try {await db(`lg_customer_mail?id=eq.${mail.id}&state=eq.sending`,{method:'PATCH',body:JSON.stringify({state,provider_id:providerId})});}
    catch {return 'uncertain';}
    return state;
  };
  return {enabled,summary,send};
}
