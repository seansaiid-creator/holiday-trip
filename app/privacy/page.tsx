import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - HolidayTrip',
  description: 'HolidayTrip privacy policy. Learn how we collect, use, and protect your information.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-8 inline-block">
          ← Back to home
        </Link>

        <h1 className="text-5xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: April 17, 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <p className="text-lg leading-relaxed">
            HolidayTrip ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website holiday-trip.com (the "Service").
          </p>

          <p>
            Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the Service.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">1. Information We Collect</h2>
          
          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">1.1 Information You Provide</h3>
          <p>
            We may collect information that you voluntarily provide when you:
          </p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>Contact us via email or contact forms</li>
            <li>Submit comments or feedback on our Service</li>
            <li>Subscribe to newsletters or notifications</li>
          </ul>
          <p>
            This information may include your name, email address, country of residence, and any other information you choose to provide.
          </p>

          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">1.2 Automatically Collected Information</h3>
          <p>
            When you visit our Service, we automatically collect certain information about your device, including:
          </p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>IP address</li>
            <li>Browser type and version</li>
            <li>Operating system</li>
            <li>Referring website</li>
            <li>Pages viewed and time spent on pages</li>
            <li>Date and time of visit</li>
            <li>Geographic location (country/region level)</li>
            <li>Device type (mobile, desktop, tablet)</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">1.3 Cookies and Tracking Technologies</h3>
          <p>
            We use cookies, web beacons, and similar tracking technologies to track activity on our Service and store certain information. Cookies are files with a small amount of data which may include an anonymous unique identifier.
          </p>
          <p>
            You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">2. How We Use Your Information</h2>
          <p>We use the collected information for various purposes:</p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>To provide and maintain our Service</li>
            <li>To improve user experience and optimize our Service</li>
            <li>To respond to your inquiries and customer service requests</li>
            <li>To analyze usage patterns and trends</li>
            <li>To detect, prevent, and address technical issues or fraudulent activity</li>
            <li>To comply with legal obligations</li>
            <li>To send periodic emails (with your consent)</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">3. Third-Party Services</h2>

          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">3.1 Google Analytics</h3>
          <p>
            We may use Google Analytics to analyze the use of our Service. Google Analytics gathers information about website use by means of cookies. The information gathered is used to create reports about the use of our Service. Google's privacy policy is available at: <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a>
          </p>

          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">3.2 Google AdSense</h3>
          <p>
            We use Google AdSense to display advertisements on our Service. Google AdSense uses cookies to serve ads based on users' prior visits to our website and other websites. Users may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.
          </p>
          <p>
            Third-party vendors, including Google, use cookies to serve ads based on your visits to this and other websites. You may opt out of personalized advertising by visiting <a href="https://www.aboutads.info" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">www.aboutads.info</a>.
          </p>

          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">3.3 Affiliate Links</h3>
          <p>
            Our Service may contain affiliate links to third-party products and services (such as Booking.com, Airalo, SafetyWing, and others). If you click these links and make a purchase, we may earn a commission at no additional cost to you. These third parties have their own privacy policies, and we recommend you review them before providing any information.
          </p>

          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">3.4 Other Third-Party Services</h3>
          <p>
            We use various third-party services to operate our platform:
          </p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li><strong>Supabase:</strong> For database hosting and management</li>
            <li><strong>Vercel:</strong> For website hosting and deployment</li>
            <li><strong>Nager.Date:</strong> For public holiday data</li>
            <li><strong>Anthropic (Claude):</strong> For AI-powered content generation</li>
          </ul>
          <p>
            Each of these services has its own privacy policies and data handling practices.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">4. Data Sharing and Disclosure</h2>
          <p>We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:</p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li><strong>Service Providers:</strong> With third-party vendors who perform services on our behalf (hosting, analytics, etc.)</li>
            <li><strong>Legal Requirements:</strong> When required by law, court order, or government regulation</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            <li><strong>Protection of Rights:</strong> To protect our rights, property, or safety, or that of our users</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">5. Data Security</h2>
          <p>
            We implement reasonable technical and organizational security measures to protect your information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">6. Your Privacy Rights</h2>

          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">6.1 GDPR (European Users)</h3>
          <p>If you are a resident of the European Economic Area (EEA), you have the following rights:</p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>Right to access your personal data</li>
            <li>Right to rectification of inaccurate data</li>
            <li>Right to erasure ("right to be forgotten")</li>
            <li>Right to restrict processing</li>
            <li>Right to data portability</li>
            <li>Right to object to processing</li>
            <li>Right to withdraw consent at any time</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">6.2 CCPA (California Users)</h3>
          <p>If you are a California resident, you have specific rights under the California Consumer Privacy Act (CCPA):</p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>Right to know what personal information is collected</li>
            <li>Right to know whether personal information is sold or disclosed</li>
            <li>Right to opt-out of the sale of personal information</li>
            <li>Right to request deletion of personal information</li>
            <li>Right to non-discrimination for exercising privacy rights</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-900 mt-8 mb-3">6.3 PIPA (Korean Users)</h3>
          <p>Korean users have rights under the Personal Information Protection Act (PIPA), including access, correction, deletion, and objection to processing of personal data.</p>

          <p className="mt-4">
            To exercise any of these rights, please contact us at <a href="mailto:seansaiid@gmail.com" className="text-blue-600 hover:underline">seansaiid@gmail.com</a>.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">7. Children's Privacy</h2>
          <p>
            Our Service is not intended for children under the age of 13 (or 16 in the EEA). We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us, and we will take steps to delete such information.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">8. International Data Transfers</h2>
          <p>
            Your information may be transferred to and maintained on servers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ. By using our Service, you consent to such transfers.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">9. Data Retention</h2>
          <p>
            We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, comply with legal obligations, resolve disputes, and enforce our agreements.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">10. Third-Party Links</h2>
          <p>
            Our Service may contain links to third-party websites. We are not responsible for the privacy practices or content of these websites. We encourage you to review the privacy policies of any third-party sites you visit.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">11. Do Not Track Signals</h2>
          <p>
            Some browsers support a "Do Not Track" feature. Our Service does not currently respond to Do Not Track signals, as there is no industry standard for their interpretation.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">12. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">13. Contact Us</h2>
          <p>
            If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:
          </p>
          <div className="bg-gray-50 rounded-lg p-6 mt-4">
            <p className="font-semibold text-gray-900">SE Company</p>
            <p className="text-sm text-gray-600 mt-1">Operator of HolidayTrip (holiday-trip.com)</p>
            <p className="mt-3">Email: <a href="mailto:seansaiid@gmail.com" className="text-blue-600 hover:underline">seansaiid@gmail.com</a></p>
            <p>Website: <Link href="/" className="text-blue-600 hover:underline">holiday-trip.com</Link></p>
          </div>
        </div>
      </div>

      <footer className="bg-gray-900 text-gray-400 py-12 mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-white text-lg font-bold">HolidayTrip</div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="hover:text-white">About</Link>
              <Link href="/contact" className="hover:text-white">Contact</Link>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
            </div>
          </div>
          <div className="text-center text-sm mt-6">
            © 2026 HolidayTrip. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}