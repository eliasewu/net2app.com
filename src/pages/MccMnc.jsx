import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Full global MCC/MNC dataset — 192+ countries
const FULL_MCCMNC = [
  // ── North America ──────────────────────────────────────────────────────────
  { mcc:"310", mnc:"410", country:"United States", network:"AT&T", prefix:"1", iso:"US" },
  { mcc:"310", mnc:"260", country:"United States", network:"T-Mobile", prefix:"1", iso:"US" },
  { mcc:"311", mnc:"480", country:"United States", network:"Verizon", prefix:"1", iso:"US" },
  { mcc:"312", mnc:"530", country:"United States", network:"Sprint (Boost)", prefix:"1", iso:"US" },
  { mcc:"302", mnc:"720", country:"Canada", network:"Rogers", prefix:"1", iso:"CA" },
  { mcc:"302", mnc:"610", country:"Canada", network:"Bell", prefix:"1", iso:"CA" },
  { mcc:"302", mnc:"220", country:"Canada", network:"Telus", prefix:"1", iso:"CA" },
  { mcc:"334", mnc:"020", country:"Mexico", network:"Telcel", prefix:"52", iso:"MX" },
  { mcc:"334", mnc:"050", country:"Mexico", network:"AT&T Mexico", prefix:"52", iso:"MX" },
  // ── Europe ────────────────────────────────────────────────────────────────
  { mcc:"234", mnc:"10", country:"United Kingdom", network:"O2", prefix:"44", iso:"GB" },
  { mcc:"234", mnc:"15", country:"United Kingdom", network:"Vodafone UK", prefix:"44", iso:"GB" },
  { mcc:"234", mnc:"20", country:"United Kingdom", network:"Three UK", prefix:"44", iso:"GB" },
  { mcc:"234", mnc:"30", country:"United Kingdom", network:"EE", prefix:"44", iso:"GB" },
  { mcc:"262", mnc:"01", country:"Germany", network:"T-Mobile DE", prefix:"49", iso:"DE" },
  { mcc:"262", mnc:"02", country:"Germany", network:"Vodafone DE", prefix:"49", iso:"DE" },
  { mcc:"262", mnc:"07", country:"Germany", network:"O2 DE", prefix:"49", iso:"DE" },
  { mcc:"208", mnc:"01", country:"France", network:"Orange FR", prefix:"33", iso:"FR" },
  { mcc:"208", mnc:"10", country:"France", network:"SFR", prefix:"33", iso:"FR" },
  { mcc:"208", mnc:"20", country:"France", network:"Bouygues", prefix:"33", iso:"FR" },
  { mcc:"222", mnc:"01", country:"Italy", network:"TIM", prefix:"39", iso:"IT" },
  { mcc:"222", mnc:"10", country:"Italy", network:"Vodafone IT", prefix:"39", iso:"IT" },
  { mcc:"222", mnc:"88", country:"Italy", network:"Wind", prefix:"39", iso:"IT" },
  { mcc:"214", mnc:"01", country:"Spain", network:"Vodafone ES", prefix:"34", iso:"ES" },
  { mcc:"214", mnc:"03", country:"Spain", network:"Orange ES", prefix:"34", iso:"ES" },
  { mcc:"214", mnc:"07", country:"Spain", network:"Movistar", prefix:"34", iso:"ES" },
  { mcc:"204", mnc:"04", country:"Netherlands", network:"Vodafone NL", prefix:"31", iso:"NL" },
  { mcc:"204", mnc:"08", country:"Netherlands", network:"KPN", prefix:"31", iso:"NL" },
  { mcc:"206", mnc:"01", country:"Belgium", network:"Proximus", prefix:"32", iso:"BE" },
  { mcc:"206", mnc:"05", country:"Belgium", network:"Telenet", prefix:"32", iso:"BE" },
  { mcc:"238", mnc:"01", country:"Denmark", network:"TDC", prefix:"45", iso:"DK" },
  { mcc:"242", mnc:"01", country:"Norway", network:"Telenor NO", prefix:"47", iso:"NO" },
  { mcc:"240", mnc:"01", country:"Sweden", network:"Telia SE", prefix:"46", iso:"SE" },
  { mcc:"244", mnc:"03", country:"Finland", network:"DNA", prefix:"358", iso:"FI" },
  { mcc:"272", mnc:"01", country:"Ireland", network:"Vodafone IE", prefix:"353", iso:"IE" },
  { mcc:"228", mnc:"01", country:"Switzerland", network:"Swisscom", prefix:"41", iso:"CH" },
  { mcc:"232", mnc:"01", country:"Austria", network:"A1 Telekom", prefix:"43", iso:"AT" },
  { mcc:"268", mnc:"01", country:"Portugal", network:"Vodafone PT", prefix:"351", iso:"PT" },
  { mcc:"202", mnc:"01", country:"Greece", network:"Cosmote", prefix:"30", iso:"GR" },
  { mcc:"260", mnc:"01", country:"Poland", network:"Plus", prefix:"48", iso:"PL" },
  { mcc:"230", mnc:"01", country:"Czech Republic", network:"T-Mobile CZ", prefix:"420", iso:"CZ" },
  { mcc:"231", mnc:"01", country:"Slovakia", network:"Orange SK", prefix:"421", iso:"SK" },
  { mcc:"216", mnc:"01", country:"Hungary", network:"Telenor HU", prefix:"36", iso:"HU" },
  { mcc:"226", mnc:"01", country:"Romania", network:"Orange RO", prefix:"40", iso:"RO" },
  { mcc:"284", mnc:"01", country:"Bulgaria", network:"A1 BG", prefix:"359", iso:"BG" },
  { mcc:"219", mnc:"01", country:"Croatia", network:"HT Croatia", prefix:"385", iso:"HR" },
  { mcc:"220", mnc:"01", country:"Serbia", network:"Telekom Srbija", prefix:"381", iso:"RS" },
  { mcc:"293", mnc:"41", country:"Slovenia", network:"A1 SI", prefix:"386", iso:"SI" },
  { mcc:"218", mnc:"05", country:"Bosnia & Herzegovina", network:"BH Telecom", prefix:"387", iso:"BA" },
  { mcc:"294", mnc:"02", country:"North Macedonia", network:"A1 MK", prefix:"389", iso:"MK" },
  { mcc:"297", mnc:"01", country:"Montenegro", network:"Crnogorski", prefix:"382", iso:"ME" },
  { mcc:"276", mnc:"01", country:"Albania", network:"ALBtelecom", prefix:"355", iso:"AL" },
  { mcc:"212", mnc:"01", country:"Monaco", network:"Monaco Telecom", prefix:"377", iso:"MC" },
  { mcc:"270", mnc:"01", country:"Luxembourg", network:"POST LU", prefix:"352", iso:"LU" },
  { mcc:"278", mnc:"21", country:"Malta", network:"GO", prefix:"356", iso:"MT" },
  { mcc:"248", mnc:"01", country:"Georgia", network:"Geocell", prefix:"995", iso:"GE" },
  { mcc:"283", mnc:"01", country:"Armenia", network:"ArmenTel", prefix:"374", iso:"AM" },
  { mcc:"282", mnc:"01", country:"Azerbaijan", network:"Azercell", prefix:"994", iso:"AZ" },
  { mcc:"250", mnc:"01", country:"Russia", network:"MTS", prefix:"7", iso:"RU" },
  { mcc:"250", mnc:"02", country:"Russia", network:"MegaFon", prefix:"7", iso:"RU" },
  { mcc:"250", mnc:"99", country:"Russia", network:"Beeline", prefix:"7", iso:"RU" },
  { mcc:"255", mnc:"01", country:"Ukraine", network:"MTS UA", prefix:"380", iso:"UA" },
  { mcc:"257", mnc:"01", country:"Belarus", network:"A1 BY", prefix:"375", iso:"BY" },
  { mcc:"246", mnc:"01", country:"Lithuania", network:"Telia LT", prefix:"370", iso:"LT" },
  { mcc:"247", mnc:"01", country:"Latvia", network:"LMT", prefix:"371", iso:"LV" },
  { mcc:"248", mnc:"71", country:"Estonia", network:"Telia EE", prefix:"372", iso:"EE" },
  { mcc:"280", mnc:"01", country:"Cyprus", network:"Cytamobile", prefix:"357", iso:"CY" },
  { mcc:"286", mnc:"01", country:"Turkey", network:"Turkcell", prefix:"90", iso:"TR" },
  { mcc:"286", mnc:"02", country:"Turkey", network:"Vodafone TR", prefix:"90", iso:"TR" },
  // ── South Asia ────────────────────────────────────────────────────────────
  { mcc:"404", mnc:"10", country:"India", network:"Airtel IN", prefix:"91", iso:"IN" },
  { mcc:"404", mnc:"45", country:"India", network:"Airtel IN 2", prefix:"91", iso:"IN" },
  { mcc:"404", mnc:"86", country:"India", network:"Vodafone IN", prefix:"91", iso:"IN" },
  { mcc:"405", mnc:"854", country:"India", network:"Jio", prefix:"91", iso:"IN" },
  { mcc:"404", mnc:"20", country:"India", network:"Aircel", prefix:"91", iso:"IN" },
  { mcc:"404", mnc:"07", country:"India", network:"BSNL", prefix:"91", iso:"IN" },
  { mcc:"470", mnc:"01", country:"Bangladesh", network:"Grameenphone", prefix:"880", iso:"BD" },
  { mcc:"470", mnc:"02", country:"Bangladesh", network:"Robi", prefix:"880", iso:"BD" },
  { mcc:"470", mnc:"03", country:"Bangladesh", network:"Banglalink", prefix:"880", iso:"BD" },
  { mcc:"470", mnc:"05", country:"Bangladesh", network:"Teletalk", prefix:"880", iso:"BD" },
  { mcc:"470", mnc:"07", country:"Bangladesh", network:"Airtel BD", prefix:"880", iso:"BD" },
  { mcc:"413", mnc:"01", country:"Sri Lanka", network:"Mobitel", prefix:"94", iso:"LK" },
  { mcc:"413", mnc:"02", country:"Sri Lanka", network:"Dialog", prefix:"94", iso:"LK" },
  { mcc:"429", mnc:"01", country:"Nepal", network:"Ncell", prefix:"977", iso:"NP" },
  { mcc:"429", mnc:"02", country:"Nepal", network:"NTC", prefix:"977", iso:"NP" },
  { mcc:"472", mnc:"01", country:"Maldives", network:"Dhiraagu", prefix:"960", iso:"MV" },
  { mcc:"436", mnc:"01", country:"Tajikistan", network:"Tcell", prefix:"992", iso:"TJ" },
  { mcc:"434", mnc:"01", country:"Uzbekistan", network:"Ucell", prefix:"998", iso:"UZ" },
  { mcc:"437", mnc:"01", country:"Kyrgyzstan", network:"Beeline KG", prefix:"996", iso:"KG" },
  { mcc:"438", mnc:"01", country:"Turkmenistan", network:"Altyn Asyr", prefix:"993", iso:"TM" },
  // ── Southeast Asia ────────────────────────────────────────────────────────
  { mcc:"502", mnc:"12", country:"Malaysia", network:"Maxis", prefix:"60", iso:"MY" },
  { mcc:"502", mnc:"16", country:"Malaysia", network:"DiGi", prefix:"60", iso:"MY" },
  { mcc:"502", mnc:"19", country:"Malaysia", network:"Celcom", prefix:"60", iso:"MY" },
  { mcc:"520", mnc:"01", country:"Thailand", network:"AIS TH", prefix:"66", iso:"TH" },
  { mcc:"520", mnc:"18", country:"Thailand", network:"DTAC", prefix:"66", iso:"TH" },
  { mcc:"515", mnc:"02", country:"Philippines", network:"Globe PH", prefix:"63", iso:"PH" },
  { mcc:"515", mnc:"05", country:"Philippines", network:"Smart", prefix:"63", iso:"PH" },
  { mcc:"525", mnc:"01", country:"Singapore", network:"SingTel", prefix:"65", iso:"SG" },
  { mcc:"525", mnc:"05", country:"Singapore", network:"StarHub", prefix:"65", iso:"SG" },
  { mcc:"510", mnc:"01", country:"Indonesia", network:"Indosat", prefix:"62", iso:"ID" },
  { mcc:"510", mnc:"10", country:"Indonesia", network:"Telkomsel", prefix:"62", iso:"ID" },
  { mcc:"452", mnc:"01", country:"Vietnam", network:"Mobifone", prefix:"84", iso:"VN" },
  { mcc:"452", mnc:"04", country:"Vietnam", network:"Viettel", prefix:"84", iso:"VN" },
  { mcc:"456", mnc:"01", country:"Cambodia", network:"Metfone", prefix:"855", iso:"KH" },
  { mcc:"457", mnc:"01", country:"Laos", network:"LTC", prefix:"856", iso:"LA" },
  { mcc:"414", mnc:"01", country:"Myanmar", network:"MPT", prefix:"95", iso:"MM" },
  { mcc:"514", mnc:"02", country:"Timor-Leste", network:"Timor Telecom", prefix:"670", iso:"TL" },
  { mcc:"528", mnc:"11", country:"Brunei", network:"DST", prefix:"673", iso:"BN" },
  // ── East Asia ─────────────────────────────────────────────────────────────
  { mcc:"460", mnc:"00", country:"China", network:"China Mobile", prefix:"86", iso:"CN" },
  { mcc:"460", mnc:"01", country:"China", network:"China Unicom", prefix:"86", iso:"CN" },
  { mcc:"460", mnc:"11", country:"China", network:"China Telecom", prefix:"86", iso:"CN" },
  { mcc:"440", mnc:"10", country:"Japan", network:"NTT Docomo", prefix:"81", iso:"JP" },
  { mcc:"440", mnc:"20", country:"Japan", network:"SoftBank", prefix:"81", iso:"JP" },
  { mcc:"450", mnc:"05", country:"South Korea", network:"SK Telecom", prefix:"82", iso:"KR" },
  { mcc:"450", mnc:"08", country:"South Korea", network:"KT", prefix:"82", iso:"KR" },
  { mcc:"466", mnc:"01", country:"Taiwan", network:"Far EasTone", prefix:"886", iso:"TW" },
  { mcc:"454", mnc:"00", country:"Hong Kong", network:"CSL", prefix:"852", iso:"HK" },
  { mcc:"455", mnc:"00", country:"Macau", network:"CTM", prefix:"853", iso:"MO" },
  { mcc:"428", mnc:"99", country:"Mongolia", network:"Unitel MN", prefix:"976", iso:"MN" },
  // ── Middle East ───────────────────────────────────────────────────────────
  { mcc:"424", mnc:"02", country:"UAE", network:"Etisalat", prefix:"971", iso:"AE" },
  { mcc:"424", mnc:"03", country:"UAE", network:"du", prefix:"971", iso:"AE" },
  { mcc:"420", mnc:"01", country:"Saudi Arabia", network:"STC", prefix:"966", iso:"SA" },
  { mcc:"420", mnc:"03", country:"Saudi Arabia", network:"Mobily", prefix:"966", iso:"SA" },
  { mcc:"420", mnc:"04", country:"Saudi Arabia", network:"Zain SA", prefix:"966", iso:"SA" },
  { mcc:"419", mnc:"02", country:"Kuwait", network:"Zain KW", prefix:"965", iso:"KW" },
  { mcc:"426", mnc:"01", country:"Bahrain", network:"Batelco", prefix:"973", iso:"BH" },
  { mcc:"422", mnc:"02", country:"Oman", network:"Omantel", prefix:"968", iso:"OM" },
  { mcc:"427", mnc:"01", country:"Qatar", network:"Ooredoo QA", prefix:"974", iso:"QA" },
  { mcc:"418", mnc:"05", country:"Iraq", network:"Zain IQ", prefix:"964", iso:"IQ" },
  { mcc:"418", mnc:"20", country:"Iraq", network:"Asia Cell", prefix:"964", iso:"IQ" },
  { mcc:"432", mnc:"11", country:"Iran", network:"MCI IR", prefix:"98", iso:"IR" },
  { mcc:"432", mnc:"14", country:"Iran", network:"Irancell", prefix:"98", iso:"IR" },
  { mcc:"416", mnc:"01", country:"Jordan", network:"Zain JO", prefix:"962", iso:"JO" },
  { mcc:"415", mnc:"01", country:"Lebanon", network:"Alfa", prefix:"961", iso:"LB" },
  { mcc:"425", mnc:"02", country:"Palestine", network:"Jawwal", prefix:"970", iso:"PS" },
  { mcc:"425", mnc:"01", country:"Israel", network:"Partner", prefix:"972", iso:"IL" },
  { mcc:"417", mnc:"09", country:"Syria", network:"Syriatel", prefix:"963", iso:"SY" },
  { mcc:"421", mnc:"02", country:"Yemen", network:"MTN YE", prefix:"967", iso:"YE" },
  // ── Africa ────────────────────────────────────────────────────────────────
  { mcc:"605", mnc:"02", country:"Tunisia", network:"Ooredoo TN", prefix:"216", iso:"TN" },
  { mcc:"603", mnc:"01", country:"Algeria", network:"Mobilis", prefix:"213", iso:"DZ" },
  { mcc:"604", mnc:"01", country:"Morocco", network:"IAM", prefix:"212", iso:"MA" },
  { mcc:"602", mnc:"01", country:"Egypt", network:"Vodafone EG", prefix:"20", iso:"EG" },
  { mcc:"602", mnc:"02", country:"Egypt", network:"Orange EG", prefix:"20", iso:"EG" },
  { mcc:"631", mnc:"04", country:"Angola", network:"Unitel AO", prefix:"244", iso:"AO" },
  { mcc:"621", mnc:"30", country:"Nigeria", network:"MTN NG", prefix:"234", iso:"NG" },
  { mcc:"621", mnc:"20", country:"Nigeria", network:"Airtel NG", prefix:"234", iso:"NG" },
  { mcc:"620", mnc:"01", country:"Ghana", network:"MTN GH", prefix:"233", iso:"GH" },
  { mcc:"620", mnc:"02", country:"Ghana", network:"Vodafone GH", prefix:"233", iso:"GH" },
  { mcc:"616", mnc:"01", country:"Benin", network:"MTN BJ", prefix:"229", iso:"BJ" },
  { mcc:"614", mnc:"01", country:"Niger", network:"Airtel NE", prefix:"227", iso:"NE" },
  { mcc:"608", mnc:"01", country:"Senegal", network:"Orange SN", prefix:"221", iso:"SN" },
  { mcc:"609", mnc:"10", country:"Guinea-Bissau", network:"MTN GW", prefix:"245", iso:"GW" },
  { mcc:"611", mnc:"02", country:"Guinea", network:"MTN GN", prefix:"224", iso:"GN" },
  { mcc:"612", mnc:"03", country:"Ivory Coast", network:"MTN CI", prefix:"225", iso:"CI" },
  { mcc:"613", mnc:"03", country:"Burkina Faso", network:"Airtel BF", prefix:"226", iso:"BF" },
  { mcc:"615", mnc:"01", country:"Togo", network:"Togocel", prefix:"228", iso:"TG" },
  { mcc:"617", mnc:"01", country:"Mauritius", network:"Emtel", prefix:"230", iso:"MU" },
  { mcc:"618", mnc:"01", country:"Liberia", network:"Lonestar", prefix:"231", iso:"LR" },
  { mcc:"619", mnc:"01", country:"Sierra Leone", network:"Airtel SL", prefix:"232", iso:"SL" },
  { mcc:"622", mnc:"01", country:"São Tomé", network:"CST", prefix:"239", iso:"ST" },
  { mcc:"623", mnc:"01", country:"CAR", network:"Orange CF", prefix:"236", iso:"CF" },
  { mcc:"624", mnc:"02", country:"Cameroon", network:"MTN CM", prefix:"237", iso:"CM" },
  { mcc:"625", mnc:"01", country:"Cape Verde", network:"CV Movel", prefix:"238", iso:"CV" },
  { mcc:"626", mnc:"01", country:"Equatorial Guinea", network:"Orange GQ", prefix:"240", iso:"GQ" },
  { mcc:"627", mnc:"01", country:"Gabon", network:"Airtel GA", prefix:"241", iso:"GA" },
  { mcc:"628", mnc:"01", country:"Congo", network:"Airtel CG", prefix:"242", iso:"CG" },
  { mcc:"629", mnc:"10", country:"DRC", network:"Vodacom CD", prefix:"243", iso:"CD" },
  { mcc:"630", mnc:"89", country:"Madagascar", network:"Airtel MG", prefix:"261", iso:"MG" },
  { mcc:"632", mnc:"07", country:"Reunion", network:"SFR RE", prefix:"262", iso:"RE" },
  { mcc:"633", mnc:"10", country:"Seychelles", network:"Airtel SC", prefix:"248", iso:"SC" },
  { mcc:"635", mnc:"10", country:"Tanzania", network:"Vodacom TZ", prefix:"255", iso:"TZ" },
  { mcc:"636", mnc:"01", country:"Ethiopia", network:"EthioTelecom", prefix:"251", iso:"ET" },
  { mcc:"637", mnc:"10", country:"Somalia", network:"Hormuud", prefix:"252", iso:"SO" },
  { mcc:"638", mnc:"01", country:"Djibouti", network:"Evatis", prefix:"253", iso:"DJ" },
  { mcc:"639", mnc:"07", country:"Kenya", network:"Safaricom", prefix:"254", iso:"KE" },
  { mcc:"640", mnc:"01", country:"Uganda", network:"Airtel UG", prefix:"256", iso:"UG" },
  { mcc:"641", mnc:"10", country:"Rwanda", network:"MTN RW", prefix:"250", iso:"RW" },
  { mcc:"642", mnc:"82", country:"Burundi", network:"Leo BDI", prefix:"257", iso:"BI" },
  { mcc:"643", mnc:"01", country:"Mozambique", network:"Vodacom MZ", prefix:"258", iso:"MZ" },
  { mcc:"645", mnc:"03", country:"Zambia", network:"Airtel ZM", prefix:"260", iso:"ZM" },
  { mcc:"646", mnc:"02", country:"Madagascar", network:"Orange MG", prefix:"261", iso:"MG" },
  { mcc:"647", mnc:"00", country:"Mayotte", network:"SFR MY", prefix:"262", iso:"YT" },
  { mcc:"648", mnc:"01", country:"Zimbabwe", network:"Econet", prefix:"263", iso:"ZW" },
  { mcc:"649", mnc:"04", country:"Namibia", network:"MTC NA", prefix:"264", iso:"NA" },
  { mcc:"650", mnc:"01", country:"Malawi", network:"Airtel MW", prefix:"265", iso:"MW" },
  { mcc:"651", mnc:"02", country:"Lesotho", network:"Econet LS", prefix:"266", iso:"LS" },
  { mcc:"652", mnc:"01", country:"Botswana", network:"Mascom", prefix:"267", iso:"BW" },
  { mcc:"653", mnc:"01", country:"Eswatini", network:"MTN SZ", prefix:"268", iso:"SZ" },
  { mcc:"654", mnc:"01", country:"Comoros", network:"HURI", prefix:"269", iso:"KM" },
  { mcc:"655", mnc:"01", country:"South Africa", network:"Vodacom ZA", prefix:"27", iso:"ZA" },
  { mcc:"655", mnc:"07", country:"South Africa", network:"MTN ZA", prefix:"27", iso:"ZA" },
  { mcc:"657", mnc:"02", country:"Eritrea", network:"Eritel", prefix:"291", iso:"ER" },
  { mcc:"659", mnc:"04", country:"Sudan", network:"Zain SD", prefix:"249", iso:"SD" },
  { mcc:"660", mnc:"01", country:"South Sudan", network:"MTN SS", prefix:"211", iso:"SS" },
  { mcc:"606", mnc:"00", country:"Libya", network:"Libyana", prefix:"218", iso:"LY" },
  { mcc:"607", mnc:"01", country:"Gambia", network:"Africell GM", prefix:"220", iso:"GM" },
  { mcc:"616", mnc:"05", country:"Benin", network:"Moov BJ", prefix:"229", iso:"BJ" },
  { mcc:"634", mnc:"01", country:"South Sudan", network:"Vivacell SS", prefix:"211", iso:"SS" },
  // ── Oceania ───────────────────────────────────────────────────────────────
  { mcc:"505", mnc:"01", country:"Australia", network:"Telstra", prefix:"61", iso:"AU" },
  { mcc:"505", mnc:"02", country:"Australia", network:"Optus", prefix:"61", iso:"AU" },
  { mcc:"505", mnc:"03", country:"Australia", network:"Vodafone AU", prefix:"61", iso:"AU" },
  { mcc:"530", mnc:"01", country:"New Zealand", network:"Spark NZ", prefix:"64", iso:"NZ" },
  { mcc:"530", mnc:"05", country:"New Zealand", network:"2degrees", prefix:"64", iso:"NZ" },
  { mcc:"541", mnc:"01", country:"Papua New Guinea", network:"Digicel PG", prefix:"675", iso:"PG" },
  { mcc:"542", mnc:"01", country:"Fiji", network:"Vodafone FJ", prefix:"679", iso:"FJ" },
  { mcc:"545", mnc:"01", country:"Kiribati", network:"Kiribati Telecom", prefix:"686", iso:"KI" },
  { mcc:"546", mnc:"01", country:"New Caledonia", network:"OPT NC", prefix:"687", iso:"NC" },
  { mcc:"547", mnc:"10", country:"French Polynesia", network:"Vini", prefix:"689", iso:"PF" },
  { mcc:"549", mnc:"01", country:"Samoa", network:"Bluesky WS", prefix:"685", iso:"WS" },
  { mcc:"550", mnc:"01", country:"Micronesia", network:"FSM Telecom", prefix:"691", iso:"FM" },
  { mcc:"551", mnc:"01", country:"Marshall Islands", network:"MINTA", prefix:"692", iso:"MH" },
  { mcc:"552", mnc:"80", country:"Palau", network:"PNCC", prefix:"680", iso:"PW" },
  { mcc:"554", mnc:"01", country:"Tuvalu", network:"Tuvalu Telecom", prefix:"688", iso:"TV" },
  { mcc:"555", mnc:"01", country:"Nauru", network:"Digicel NR", prefix:"674", iso:"NR" },
  { mcc:"539", mnc:"01", country:"Tonga", network:"Digicel TO", prefix:"676", iso:"TO" },
  { mcc:"540", mnc:"01", country:"Solomon Islands", network:"Our Telekom", prefix:"677", iso:"SB" },
  { mcc:"548", mnc:"01", country:"Cook Islands", network:"Vodafone CK", prefix:"682", iso:"CK" },
  { mcc:"553", mnc:"01", country:"Vanuatu", network:"Digicel VU", prefix:"678", iso:"VU" },
  // ── South America ─────────────────────────────────────────────────────────
  { mcc:"724", mnc:"06", country:"Brazil", network:"Claro BR", prefix:"55", iso:"BR" },
  { mcc:"724", mnc:"05", country:"Brazil", network:"TIM BR", prefix:"55", iso:"BR" },
  { mcc:"724", mnc:"10", country:"Brazil", network:"Vivo", prefix:"55", iso:"BR" },
  { mcc:"722", mnc:"310", country:"Argentina", network:"Claro AR", prefix:"54", iso:"AR" },
  { mcc:"716", mnc:"10", country:"Peru", network:"Claro PE", prefix:"51", iso:"PE" },
  { mcc:"730", mnc:"01", country:"Chile", network:"Entel CL", prefix:"56", iso:"CL" },
  { mcc:"732", mnc:"101", country:"Colombia", network:"Claro CO", prefix:"57", iso:"CO" },
  { mcc:"734", mnc:"02", country:"Venezuela", network:"Movistar VE", prefix:"58", iso:"VE" },
  { mcc:"744", mnc:"05", country:"Paraguay", network:"Tigo PY", prefix:"595", iso:"PY" },
  { mcc:"748", mnc:"07", country:"Uruguay", network:"Antel", prefix:"598", iso:"UY" },
  { mcc:"736", mnc:"01", country:"Bolivia", network:"Entel BO", prefix:"591", iso:"BO" },
  { mcc:"740", mnc:"00", country:"Ecuador", network:"Claro EC", prefix:"593", iso:"EC" },
  { mcc:"714", mnc:"02", country:"Panama", network:"Claro PA", prefix:"507", iso:"PA" },
  { mcc:"712", mnc:"01", country:"Costa Rica", network:"ICE", prefix:"506", iso:"CR" },
  { mcc:"706", mnc:"04", country:"El Salvador", network:"Claro SV", prefix:"503", iso:"SV" },
  { mcc:"704", mnc:"03", country:"Guatemala", network:"Claro GT", prefix:"502", iso:"GT" },
  { mcc:"708", mnc:"30", country:"Honduras", network:"Claro HN", prefix:"504", iso:"HN" },
  { mcc:"710", mnc:"21", country:"Nicaragua", network:"Claro NI", prefix:"505", iso:"NI" },
  { mcc:"702", mnc:"68", country:"Belize", network:"DigiCell BZ", prefix:"501", iso:"BZ" },
  { mcc:"362", mnc:"69", country:"Caribbean Netherlands", network:"Telcel AN", prefix:"599", iso:"BQ" },
  { mcc:"342", mnc:"600", country:"Barbados", network:"LIME BB", prefix:"1246", iso:"BB" },
  { mcc:"338", mnc:"050", country:"Jamaica", network:"Digicel JM", prefix:"1876", iso:"JM" },
  { mcc:"330", mnc:"110", country:"Puerto Rico", network:"T-Mobile PR", prefix:"1787", iso:"PR" },
  { mcc:"374", mnc:"130", country:"Trinidad & Tobago", network:"Digicel TT", prefix:"1868", iso:"TT" },
  { mcc:"363", mnc:"01", country:"Aruba", network:"SETAR", prefix:"297", iso:"AW" },
  { mcc:"740", mnc:"02", country:"Guyana", network:"Digicel GY", prefix:"592", iso:"GY" },
  { mcc:"746", mnc:"03", country:"Suriname", network:"Telesur", prefix:"597", iso:"SR" },
  // ── Central Asia / Caucasus ───────────────────────────────────────────────
  { mcc:"401", mnc:"01", country:"Kazakhstan", network:"Beeline KZ", prefix:"7", iso:"KZ" },
  { mcc:"401", mnc:"02", country:"Kazakhstan", network:"Kcell", prefix:"7", iso:"KZ" },
  // ── Pacific / Caribbean ───────────────────────────────────────────────────
  { mcc:"376", mnc:"350", country:"Turks & Caicos", network:"Digicel TC", prefix:"1649", iso:"TC" },
  { mcc:"364", mnc:"390", country:"Bahamas", network:"Aliv", prefix:"1242", iso:"BS" },
  { mcc:"366", mnc:"020", country:"Dominica", network:"Digicel DM", prefix:"1767", iso:"DM" },
  { mcc:"356", mnc:"050", country:"Saint Kitts & Nevis", network:"Digicel KN", prefix:"1869", iso:"KN" },
  { mcc:"358", mnc:"050", country:"Saint Lucia", network:"Digicel LC", prefix:"1758", iso:"LC" },
  { mcc:"360", mnc:"110", country:"Saint Vincent", network:"Digicel VC", prefix:"1784", iso:"VC" },
  { mcc:"368", mnc:"01", country:"Cuba", network:"Cubacel", prefix:"53", iso:"CU" },
  { mcc:"370", mnc:"01", country:"Dominican Republic", network:"Claro DR", prefix:"1809", iso:"DO" },
  { mcc:"372", mnc:"01", country:"Haiti", network:"Digicel HT", prefix:"509", iso:"HT" },
  // ── Extra/territories ─────────────────────────────────────────────────────
  { mcc:"901", mnc:"01", country:"International", network:"GSMA ICR", prefix:"", iso:"XX" },
  { mcc:"901", mnc:"11", country:"International", network:"Vodafone Intl", prefix:"", iso:"XX" },
];

export default function MccMncPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ mcc: '', mnc: '', country: '', network: '', prefix: '', iso: '' });
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const qc = useQueryClient();

  const { data: mccmncs = [] } = useQuery({
    queryKey: ['mccmnc'],
    queryFn: () => base44.entities.MccMnc.list('-country', 2000),
    initialData: [],
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.MccMnc.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mccmnc'] }); setDialogOpen(false); toast.success("MCC/MNC added"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MccMnc.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mccmnc'] }); setDialogOpen(false); toast.success("Updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.MccMnc.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mccmnc'] }); toast.success("Deleted"); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filtered = mccmncs.filter(m =>
    m.country?.toLowerCase().includes(search.toLowerCase()) ||
    m.network?.toLowerCase().includes(search.toLowerCase()) ||
    m.mcc?.includes(search) || m.mnc?.includes(search) ||
    m.iso?.toLowerCase().includes(search.toLowerCase())
  );

  // Check if a record already exists (by mcc+mnc combo)
  const existingKeys = new Set(mccmncs.map(m => `${m.mcc}-${m.mnc}`));

  const preloadAllMccMnc = async () => {
    setImporting(true);
    setImportResult(null);
    let added = 0, skipped = 0;
    const toAdd = FULL_MCCMNC.filter(r => !existingKeys.has(`${r.mcc}-${r.mnc}`));
    skipped = FULL_MCCMNC.length - toAdd.length;

    if (toAdd.length === 0) {
      toast.info(`All ${FULL_MCCMNC.length} entries already exist in the list`);
      setImporting(false);
      setImportResult({ added: 0, skipped });
      return;
    }

    // Bulk create in batches of 50
    for (let i = 0; i < toAdd.length; i += 50) {
      const batch = toAdd.slice(i, i + 50);
      await base44.entities.MccMnc.bulkCreate(batch);
      added += batch.length;
    }
    qc.invalidateQueries({ queryKey: ['mccmnc'] });
    setImportResult({ added, skipped });
    toast.success(`Imported ${added} new entries (${skipped} already existed)`);
    setImporting(false);
  };

  // Check if a new entry would be duplicate before saving
  const handleSave = () => {
    const key = `${form.mcc}-${form.mnc}`;
    if (!editing && existingKeys.has(key)) {
      toast.error(`MCC ${form.mcc} / MNC ${form.mnc} already exists in the list`);
      return;
    }
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="MCC/MNC Database" description={`${mccmncs.length} entries — Mobile country and network codes`}>
        <Button variant="outline" onClick={preloadAllMccMnc} disabled={importing}>
          <Upload className="w-4 h-4 mr-2" />{importing ? "Importing..." : `Preload ${FULL_MCCMNC.length} Networks`}
        </Button>
        <Button onClick={() => { setEditing(null); setForm({ mcc: '', mnc: '', country: '', network: '', prefix: '', iso: '' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Entry
        </Button>
      </PageHeader>

      {importResult && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-green-800">
            <strong>{importResult.added}</strong> new entries added.
            {importResult.skipped > 0 && <> <strong>{importResult.skipped}</strong> already existed — skipped.</>}
          </span>
          <button className="ml-auto text-green-600 hover:text-green-800" onClick={() => setImportResult(null)}>✕</button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search country, network, MCC, ISO..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {mccmncs.length} entries</p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MCC</TableHead>
                <TableHead>MNC</TableHead>
                <TableHead>ISO</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono font-semibold">{m.mcc}</TableCell>
                  <TableCell className="font-mono">{m.mnc}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{m.iso}</Badge></TableCell>
                  <TableCell>{m.country}</TableCell>
                  <TableCell>{m.network}</TableCell>
                  <TableCell className="font-mono text-xs">+{m.prefix}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setForm(m); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  {mccmncs.length === 0 ? 'No data. Click "Preload" to load all global MCC/MNC data.' : 'No matching results'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit MCC/MNC' : 'Add MCC/MNC'}</DialogTitle></DialogHeader>
          {/* Duplicate warning for new entries */}
          {!editing && form.mcc && form.mnc && existingKeys.has(`${form.mcc}-${form.mnc}`) && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              MCC {form.mcc} / MNC {form.mnc} already exists in the list.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>MCC *</Label><Input value={form.mcc} onChange={(e) => set('mcc', e.target.value)} /></div>
            <div className="space-y-2"><Label>MNC *</Label><Input value={form.mnc} onChange={(e) => set('mnc', e.target.value)} /></div>
            <div className="space-y-2"><Label>Country *</Label><Input value={form.country} onChange={(e) => set('country', e.target.value)} /></div>
            <div className="space-y-2"><Label>Network *</Label><Input value={form.network} onChange={(e) => set('network', e.target.value)} /></div>
            <div className="space-y-2"><Label>Prefix</Label><Input value={form.prefix} onChange={(e) => set('prefix', e.target.value)} placeholder="e.g. 880" /></div>
            <div className="space-y-2"><Label>ISO Code</Label><Input value={form.iso} onChange={(e) => set('iso', e.target.value)} placeholder="e.g. BD" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}