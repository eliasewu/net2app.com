import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const HTTP_PROVIDERS = [
  {
    name: "Teletalk BD",
    region: "Bangladesh",
    send_url: "https://bulksms.teletalk.com.bd/link_sms_send.php?op=SMS&json=true&user={username}&pass={password}&charset=UTF-8&mobile={dst}&sms={message}",
    dlr_url: "https://bulksms.teletalk.com.bd/link_sms_send.php?op=STATUS&user={username}&pass={password}&sms_id={message_id}",
    method: "GET",
    success_check: "Contains 'SUCCESS'",
    id_parse: "Split by ',' → index 1, then split by '=' → index 1",
    dlr_status: "'SENT' in response → status 2 (Delivered)",
    params: { username: "", password: "" },
    docs: "https://bulksms.teletalk.com.bd",
    color: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-800",
  },
  {
    name: "Twilio",
    region: "Global",
    send_url: "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
    method: "POST",
    auth: "Basic Auth: account_sid / auth_token",
    params: { account_sid: "", auth_token: "", from: "" },
    success_check: "HTTP 201, JSON sid field",
    docs: "https://www.twilio.com/docs/sms",
    color: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-800",
  },
  {
    name: "Vonage (Nexmo)",
    region: "Global",
    send_url: "https://rest.nexmo.com/sms/json?api_key={api_key}&api_secret={api_secret}&from={sender}&to={dst}&text={message}",
    method: "POST",
    params: { api_key: "", api_secret: "" },
    success_check: "messages[0].status == 0",
    docs: "https://developer.vonage.com/messaging/sms",
    color: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-800",
  },
  {
    name: "Infobip",
    region: "Global",
    send_url: "https://{base_url}.api.infobip.com/sms/2/text/single",
    method: "POST",
    auth: "Authorization: App {api_key}",
    params: { api_key: "", base_url: "" },
    success_check: "HTTP 200, messages[0].status.groupId == 1",
    docs: "https://www.infobip.com/docs/api",
    color: "bg-orange-50 border-orange-200",
    badge: "bg-orange-100 text-orange-800",
  },
  {
    name: "Sinch",
    region: "Global",
    send_url: "https://sms.api.sinch.com/xms/v1/{service_plan_id}/batches",
    method: "POST",
    auth: "Authorization: Bearer {api_token}",
    params: { service_plan_id: "", api_token: "" },
    success_check: "HTTP 201",
    docs: "https://developers.sinch.com/docs/sms",
    color: "bg-indigo-50 border-indigo-200",
    badge: "bg-indigo-100 text-indigo-800",
  },
  {
    name: "MessageBird (Bird)",
    region: "Global",
    send_url: "https://rest.messagebird.com/messages",
    method: "POST",
    auth: "Authorization: AccessKey {api_key}",
    params: { api_key: "" },
    success_check: "HTTP 201, id field present",
    docs: "https://developers.messagebird.com/api/sms-messaging/",
    color: "bg-sky-50 border-sky-200",
    badge: "bg-sky-100 text-sky-800",
  },
  {
    name: "Clickatell",
    region: "Global",
    send_url: "https://platform.clickatell.com/messages/http/send?apiKey={api_key}&to={dst}&content={message}",
    method: "GET",
    params: { api_key: "" },
    success_check: "HTTP 200, ID field",
    docs: "https://docs.clickatell.com",
    color: "bg-purple-50 border-purple-200",
    badge: "bg-purple-100 text-purple-800",
  },
  {
    name: "MSG91",
    region: "India",
    send_url: "https://control.msg91.com/api/v5/flow/",
    method: "POST",
    auth: "authkey header: {api_key}",
    params: { api_key: "", template_id: "" },
    success_check: "type == 'success'",
    docs: "https://msg91.com/help/MSG91/sending-message",
    color: "bg-yellow-50 border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800",
  },
  {
    name: "Africa's Talking",
    region: "Africa",
    send_url: "https://api.africastalking.com/version1/messaging",
    method: "POST",
    auth: "apiKey header: {api_key}",
    params: { api_key: "", username: "" },
    success_check: "SMSMessageData.Recipients[0].status == 'Success'",
    docs: "https://developers.africastalking.com/docs/sms/sending",
    color: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-800",
  },
  {
    name: "D7 Networks",
    region: "Middle East / Global",
    send_url: "https://api.d7networks.com/messages/v1/send",
    method: "POST",
    auth: "Authorization: Bearer {api_key}",
    params: { api_key: "" },
    success_check: "HTTP 200, request_id present",
    docs: "https://d7networks.com/docs/Messages/Send_Message/",
    color: "bg-teal-50 border-teal-200",
    badge: "bg-teal-100 text-teal-800",
  },
  {
    name: "Route Mobile",
    region: "Global",
    send_url: "https://rmlconnect.net/bulksms/bulksms?username={username}&password={password}&type=0&dlr=1&destination={dst}&source={sender}&message={message}",
    method: "GET",
    params: { username: "", password: "" },
    success_check: "HTTP 200, positive numeric message ID",
    docs: "https://www.routemobile.com/",
    color: "bg-pink-50 border-pink-200",
    badge: "bg-pink-100 text-pink-800",
  },
  {
    name: "Plivo",
    region: "Global",
    send_url: "https://api.plivo.com/v1/Account/{auth_id}/Message/",
    method: "POST",
    auth: "Basic Auth: auth_id / auth_token",
    params: { auth_id: "", auth_token: "" },
    success_check: "HTTP 202, message_uuid present",
    docs: "https://www.plivo.com/docs/sms",
    color: "bg-violet-50 border-violet-200",
    badge: "bg-violet-100 text-violet-800",
  },
  {
    name: "SMSala",
    region: "Global",
    send_url: "https://api.smsala.com/api/SendSMS?api_id={api_id}&api_password={api_password}&sms_type=T&encoding=T&sender_id={sender}&phonenumber={dst}&textmessage={message}",
    method: "GET",
    params: { api_id: "", api_password: "" },
    success_check: "HTTP 200, 'S' status code",
    docs: "https://www.smsala.com/api",
    color: "bg-cyan-50 border-cyan-200",
    badge: "bg-cyan-100 text-cyan-800",
  },
  {
    name: "Telnyx",
    region: "Global",
    send_url: "https://api.telnyx.com/v2/messages",
    method: "POST",
    auth: "Authorization: Bearer {api_key}",
    params: { api_key: "", messaging_profile_id: "" },
    success_check: "HTTP 200, data.id present",
    docs: "https://developers.telnyx.com/docs/api/v2/messaging",
    color: "bg-lime-50 border-lime-200",
    badge: "bg-lime-100 text-lime-800",
  },
  {
    name: "ClickSend",
    region: "Global",
    send_url: "https://rest.clicksend.com/v3/sms/send",
    method: "POST",
    auth: "Basic Auth: username / api_key",
    params: { username: "", api_key: "" },
    success_check: "HTTP 200, data.messages[0].status == 'SUCCESS'",
    docs: "https://developers.clicksend.com/docs/rest/v3/",
    color: "bg-rose-50 border-rose-200",
    badge: "bg-rose-100 text-rose-800",
  },
  {
    name: "Amazon SNS",
    region: "Global (AWS)",
    send_url: "https://sns.{region}.amazonaws.com/ (SDK/API)",
    method: "POST",
    auth: "AWS Signature V4: access_key + secret_key",
    params: { access_key: "", secret_key: "", region: "us-east-1" },
    success_check: "HTTP 200, MessageId present",
    docs: "https://docs.aws.amazon.com/sns/latest/api/API_Publish.html",
    color: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-800",
  },
  {
    name: "Kaleyra",
    region: "Global",
    send_url: "https://api.kaleyra.io/v1/{sid}/messages",
    method: "POST",
    auth: "api-key header: {api_key}",
    params: { sid: "", api_key: "" },
    success_check: "HTTP 200, data.id present",
    docs: "https://developers.kaleyra.io/reference",
    color: "bg-fuchsia-50 border-fuchsia-200",
    badge: "bg-fuchsia-100 text-fuchsia-800",
  },
  {
    name: "TextLocal",
    region: "UK / India",
    send_url: "https://api.txtlocal.com/send/?apikey={api_key}&sender={sender}&numbers={dst}&message={message}",
    method: "GET",
    params: { api_key: "" },
    success_check: "status == 'success'",
    docs: "https://api.txtlocal.com/docs/",
    color: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-700",
  },
  {
    name: "Telesign",
    region: "Global",
    send_url: "https://rest-api.telesign.com/v1/messaging",
    method: "POST",
    auth: "Basic Auth: customer_id / api_key",
    params: { customer_id: "", api_key: "" },
    success_check: "HTTP 200, reference_id present",
    docs: "https://developer.telesign.com/enterprise/reference/sendsmsmessage",
    color: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    name: "CM.com",
    region: "Global",
    send_url: "https://gw.cmtelecom.com/v1.0/message",
    method: "POST",
    auth: "X-CM-ProductToken header: {api_key}",
    params: { api_key: "" },
    success_check: "HTTP 200",
    docs: "https://developers.cm.com/messaging/docs/introduction",
    color: "bg-sky-50 border-sky-200",
    badge: "bg-sky-100 text-sky-700",
  },
  {
    name: "Messente",
    region: "Global",
    send_url: "https://api.messente.com/v1/omnimessage",
    method: "POST",
    auth: "Basic Auth: api_username / api_password",
    params: { api_username: "", api_password: "" },
    success_check: "HTTP 200, omnimessage_id present",
    docs: "https://messente.com/documentation",
    color: "bg-indigo-50 border-indigo-200",
    badge: "bg-indigo-100 text-indigo-700",
  },
  {
    name: "BulkSMS",
    region: "Global",
    send_url: "https://api.bulksms.com/v1/messages",
    method: "POST",
    auth: "Basic Auth: token_id / token_secret",
    params: { token_id: "", token_secret: "" },
    success_check: "HTTP 201, id present",
    docs: "https://www.bulksms.com/developer/json/v1/",
    color: "bg-orange-50 border-orange-200",
    badge: "bg-orange-100 text-orange-700",
  },
  {
    name: "SMSGlobal",
    region: "Global",
    send_url: "https://api.smsglobal.com/v2/sms/",
    method: "POST",
    auth: "Authorization: MAC",
    params: { api_key: "", secret_key: "" },
    success_check: "HTTP 200, outgoing_sms present",
    docs: "https://www.smsglobal.com/rest-api/",
    color: "bg-purple-50 border-purple-200",
    badge: "bg-purple-100 text-purple-700",
  },
  {
    name: "Cequens",
    region: "Middle East / Africa",
    send_url: "https://apis.cequens.com/sms/v1/messages",
    method: "POST",
    auth: "Authorization: Bearer {jwt_token}",
    params: { api_key: "" },
    success_check: "HTTP 200",
    docs: "https://cequens.com/documentation",
    color: "bg-teal-50 border-teal-200",
    badge: "bg-teal-100 text-teal-700",
  },
  {
    name: "2Factor",
    region: "India",
    send_url: "https://2factor.in/API/V1/{api_key}/SMS/{dst}/{message}/{sender}",
    method: "GET",
    params: { api_key: "" },
    success_check: "Status == 'Success'",
    docs: "https://2factor.in/cp/api-doc/index.php",
    color: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
  },
];

export default function HttpApiTemplates() {
  const [search, setSearch] = useState("");

  const filtered = HTTP_PROVIDERS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.region.toLowerCase().includes(search.toLowerCase())
  );

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success("Copied!"); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search providers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} providers</span>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        <strong>How to use:</strong> Copy the API URL template → Go to <strong>Add Supplier</strong> → Select "HTTP" connection type → Paste URL → Fill in your API key/credentials. Placeholders like <code>{'{api_key}'}</code>, <code>{'{username}'}</code>, <code>{'{dst}'}</code>, <code>{'{message}'}</code> are auto-substituted at send time.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(p => (
          <Card key={p.name} className={`border ${p.color}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">{p.name}</h3>
                  <Badge className={`text-[10px] ${p.badge} border-0`}>{p.region}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">{p.method}</Badge>
                  {p.docs && (
                    <a href={p.docs} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-white/60 rounded">
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </a>
                  )}
                </div>
              </div>

              {/* Send URL */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Send URL</p>
                <div className="flex items-start gap-1">
                  <code className="text-[10px] bg-gray-900 text-green-400 px-2 py-1.5 rounded flex-1 break-all font-mono leading-relaxed">{p.send_url}</code>
                  <button onClick={() => copy(p.send_url)} className="p-1 hover:bg-gray-100 rounded shrink-0 mt-0.5">
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* DLR URL if present */}
              {p.dlr_url && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">DLR / Status URL</p>
                  <div className="flex items-start gap-1">
                    <code className="text-[10px] bg-gray-900 text-yellow-300 px-2 py-1.5 rounded flex-1 break-all font-mono leading-relaxed">{p.dlr_url}</code>
                    <button onClick={() => copy(p.dlr_url)} className="p-1 hover:bg-gray-100 rounded shrink-0 mt-0.5">
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}

              {/* Auth info */}
              {p.auth && (
                <div className="text-[10px] text-muted-foreground bg-white/60 rounded px-2 py-1">
                  <span className="font-semibold">Auth:</span> {p.auth}
                </div>
              )}

              {/* Success check */}
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="bg-white/60 rounded px-2 py-0.5"><span className="font-semibold">Success:</span> {p.success_check}</span>
                {p.id_parse && <span className="bg-white/60 rounded px-2 py-0.5"><span className="font-semibold">MsgID:</span> {p.id_parse}</span>}
                {p.dlr_status && <span className="bg-white/60 rounded px-2 py-0.5"><span className="font-semibold">DLR:</span> {p.dlr_status}</span>}
              </div>

              {/* Required params */}
              {p.params && Object.keys(p.params).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] text-muted-foreground font-semibold">Credentials needed:</span>
                  {Object.keys(p.params).map(k => (
                    <Badge key={k} variant="outline" className="text-[10px] font-mono">{k}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}