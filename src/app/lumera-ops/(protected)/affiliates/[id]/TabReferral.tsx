"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Link as LinkIcon, Download, Copy, Check } from "lucide-react";
import { copyText } from "./AdminAffiliateTabs";

// One shareable link with a copy button that says it copied.
function LinkRow({ title, hint, url, warn }: { title: string; hint: string; url: string; warn?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <button
          type="button"
          onClick={copy}
          className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            copied ? "border-green-300 bg-green-50 text-green-700" : "border-line text-ink/60 hover:bg-page-bg"
          }`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="mt-0.5 text-xs text-ink/50">{hint}</p>
      <p className="mt-2 break-all rounded-lg bg-page-bg px-3 py-2 font-mono text-xs text-ink">{url}</p>
      {warn && <p className="mt-2 text-xs text-amber-700">{warn}</p>}
    </div>
  );
}

export function TabReferral({
  affiliate,
  baseUrl,
  landingPage,
  utmParams,
}: {
  affiliate: Record<string, any>;
  /** This app's public address, worked out on the server so the server and browser render the same links. */
  baseUrl: string;
  /** The store page a click lands on, UTM tags included (built on the server from the store settings). */
  landingPage: string;
  /** The UTM tags added to every click, as a query string. */
  utmParams: string;
}) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const appBaseUrl = baseUrl;
  // The same link the affiliate sees on their own dashboard: /ref/<slug> records the click, sets the tracking
  // cookie and applies their discount code. The app's homepage ignores ?ref=, so that form tracked nothing.
  const referralLink = `${appBaseUrl}/ref/${affiliate.referralSlug}`;
  const membershipLink = `${appBaseUrl}/customers/signup?ref=${affiliate.referralSlug}`;
  const teamLink = `${appBaseUrl}/sales-reps/signup?ref=${affiliate.referralSlug}`;

  useEffect(() => {
    QRCode.toDataURL(referralLink, { width: 150, margin: 1 }, (err, url) => {
      if (!err) setQrCodeUrl(url);
    });
  }, [referralLink]);

  const handleCopy = (text: string) => navigator.clipboard.writeText(text);

  const displayClicks = affiliate.clicks && affiliate.clicks.length > 0
    ? affiliate.clicks.slice(0, 5).map((c: Record<string, any>) => ({
        date: new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        source: c.source || "Direct",
        device: c.deviceType || "Unknown" // Location isn't tracked in the schema, so we show device type instead
      }))
    : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      {/* Left Column */}
      <div className="md:col-span-3 space-y-6">
        <div className="rounded-2xl border border-line bg-white shadow-sm">
          <div className="flex items-center gap-3 p-6 border-b border-line">
            <div className="bg-primary-light p-2 rounded-lg text-primary">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink leading-tight">All Referral Links</h2>
              <p className="text-xs text-ink/50">Every link this affiliate can share, and what each one does.</p>
            </div>
          </div>
          <div className="p-6 divide-y divide-line/60">
            <LinkRow
              title="Order referral link"
              hint="For shoppers. A click is tracked to this affiliate, their discount code is applied, and orders earn them commission."
              url={referralLink}
            />
            <LinkRow
              title="Membership referral link"
              hint="For customers who want a monthly membership. People who sign up through it are credited to this affiliate."
              url={membershipLink}
            />
            <LinkRow
              title="Team referral link"
              hint="For recruiting sales reps onto this affiliate's team. Reps who sign up through it are placed under them once approved."
              url={teamLink}
              warn={affiliate.canRecruit ? undefined : "Recruiting is off for this affiliate, so new reps who use this link will not be placed under them. Turn recruiting on to enable it."}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 p-6 border-b border-line">
            <div className="bg-primary-light p-2 rounded-lg text-primary">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink leading-tight">Referral Information</h2>
              <p className="text-xs text-ink/50">Your affiliate&apos;s unique referral link and details.</p>
            </div>
          </div>
          
          <div className="p-6 space-y-6 text-sm">
            <div className="flex justify-between items-center pb-4 border-b border-line/50">
              <span className="text-ink/60 w-32 shrink-0">Referral Link</span>
              <div className="flex items-center justify-between flex-1 pl-4">
                <span className="font-medium font-mono text-xs text-ink">{referralLink}</span>
                <button onClick={() => handleCopy(referralLink)} className="text-ink/40 hover:text-ink transition p-1 border border-line rounded-md ml-2 flex items-center gap-1 px-2 py-1">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-line/50">
              <span className="text-ink/60 w-32 shrink-0">Referral Code</span>
              <div className="flex items-center justify-between flex-1 pl-4">
                <span className="font-medium font-mono text-xs">{affiliate.referralSlug}</span>
                <button onClick={() => handleCopy(affiliate.referralSlug)} className="text-ink/40 hover:text-ink transition p-1 border border-line rounded-md ml-2 flex items-center gap-1 px-2 py-1">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-line/50">
              <span className="text-ink/60 w-32 shrink-0">Landing Page</span>
              <div className="flex items-center justify-between flex-1 pl-4">
                <span className="font-medium text-xs break-all">{landingPage}</span>
                <button onClick={() => handleCopy(landingPage)} className="text-ink/40 hover:text-ink transition p-1 border border-line rounded-md ml-2">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-line/50">
              <span className="text-ink/60 w-32 shrink-0">UTM Parameters</span>
              <div className="flex items-center justify-between flex-1 pl-4 overflow-hidden">
                <span className="font-medium text-xs truncate">{utmParams}</span>
                <button onClick={() => handleCopy(utmParams)} className="text-ink/40 hover:text-ink transition p-1 border border-line rounded-md ml-2 shrink-0">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-ink/60 w-32 shrink-0">QR Code</span>
              <div className="flex items-center justify-start flex-1 pl-4 gap-6">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24 border border-line rounded-lg" />
                ) : (
                  <div className="w-24 h-24 bg-line/50 rounded-lg animate-pulse" />
                )}
                <a 
                  href={qrCodeUrl} 
                  download={`qr-code-${affiliate.referralSlug}.png`}
                  className="flex items-center gap-2 px-4 py-2 border border-primary/20 bg-primary-light text-primary font-medium rounded-xl text-xs hover:bg-primary/10 transition"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="md:col-span-2 space-y-6">
        <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
          <div className="flex items-center gap-3 p-5 border-b border-line">
            <div className="bg-primary-light p-2 rounded-lg text-primary">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-ink leading-tight">Referral Share</h2>
              <p className="text-xs text-ink/50">Preview how the referral link looks when shared.</p>
            </div>
          </div>
          
          <div className="p-5 grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleCopy(referralLink)}
              className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition shadow-sm"
            >
              <Copy className="w-4 h-4" />
              Copy Link
            </button>
            <div className="col-span-2 flex gap-2">
              <button 
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, "_blank")}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-line bg-page-bg/50 text-ink/70 hover:bg-page-bg transition"
              >
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium">Facebook</span>
              </button>
              <button 
                onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(referralLink)}`, "_blank")}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-line bg-page-bg/50 text-ink/70 hover:bg-page-bg transition"
              >
                <svg className="w-4 h-4 text-sky-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
                <span className="text-xs font-medium">Twitter</span>
              </button>
              <button 
                onClick={() => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(referralLink)}`, "_blank")}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-line bg-page-bg/50 text-ink/70 hover:bg-page-bg transition"
              >
                <svg className="w-4 h-4 text-blue-700" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium">LinkedIn</span>
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-line">
            <h2 className="font-heading text-base font-semibold text-ink leading-tight">Recent Referrals</h2>
          </div>

          <div className="p-0 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-page-bg border-b border-line text-ink/60">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {displayClicks.length > 0 ? (
                  displayClicks.map((click: Record<string, any>, idx: number) => (
                    <tr key={idx} className="hover:bg-page-bg/50 transition">
                      <td className="px-5 py-3 text-ink/80">{click.date}</td>
                      <td className="px-5 py-3 text-ink/80">{click.source}</td>
                      <td className="px-5 py-3 text-ink/80">{click.device}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-ink/50 text-xs">
                      No recent referrals found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
