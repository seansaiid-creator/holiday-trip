import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service - HolidayTrip',
  description: 'HolidayTrip terms of service. Read our usage terms, disclaimers, and liability limitations.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-8 inline-block">
          ← Back to home
        </Link>

        <h1 className="text-5xl font-bold text-gray-900 mb-4">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: April 17, 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <p className="text-lg leading-relaxed">
            Welcome to HolidayTrip. These Terms of Service ("Terms") govern your access to and use of the website located at holiday-trip.com (the "Service"), operated by HolidayTrip ("we," "us," or "our").
          </p>

          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg">
            <p className="text-sm font-semibold">
              PLEASE READ THESE TERMS CAREFULLY BEFORE USING THE SERVICE. By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access the Service.
            </p>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing and using HolidayTrip, you accept and agree to be bound by the terms and provisions of this agreement. These Terms apply to all visitors, users, and others who access or use the Service.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">2. Description of Service</h2>
          <p>
            HolidayTrip provides information about public holidays, cultural celebrations, travel information (including but not limited to currency, voltage, plug types, timezones), price comparisons, and related content for various countries worldwide. The Service is provided for informational and reference purposes only.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">3. DISCLAIMER OF INFORMATION ACCURACY</h2>
          <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg">
            <p className="font-semibold text-gray-900 mb-4">IMPORTANT NOTICE REGARDING INFORMATION ACCURACY:</p>
            <p className="mb-4">
              ALL INFORMATION PROVIDED ON HOLIDAYTRIP IS FOR GENERAL REFERENCE PURPOSES ONLY AND MAY BE INACCURATE, INCOMPLETE, OR OUTDATED. THIS INCLUDES BUT IS NOT LIMITED TO:
            </p>
            <ul className="space-y-2 list-disc list-inside ml-4">
              <li>Public holiday dates, names, and observances</li>
              <li>Cultural practices and traditions</li>
              <li>Currency information and exchange rates</li>
              <li>Electrical voltage and plug type specifications</li>
              <li>Timezone information</li>
              <li>Price comparisons and cost of living data</li>
              <li>Product prices and availability</li>
              <li>Travel tips and recommendations</li>
              <li>Business hours and operational information</li>
              <li>Transportation and accessibility information</li>
              <li>Visa, passport, and immigration information</li>
              <li>Any other data or information displayed on the Service</li>
            </ul>
          </div>

          <p className="font-semibold mt-6">
            YOU ACKNOWLEDGE AND AGREE THAT:
          </p>
          <ul className="space-y-3 list-disc list-inside ml-4">
            <li>Holiday dates and observances may change due to governmental decisions, religious calendars, or regional variations</li>
            <li>Prices displayed are approximate and may vary significantly based on location, season, establishment, and market conditions</li>
            <li>Electrical specifications may differ within the same country</li>
            <li>All information may become outdated without notice</li>
            <li>Official holidays may be moved, added, or removed at any time by relevant authorities</li>
            <li>Cultural information may be generalized and may not reflect specific regional practices</li>
          </ul>

          <p className="font-semibold text-red-600 mt-6">
            YOU MUST VERIFY ALL CRITICAL INFORMATION THROUGH OFFICIAL AND RELIABLE SOURCES BEFORE MAKING ANY DECISIONS BASED ON INFORMATION FROM OUR SERVICE, ESPECIALLY FOR:
          </p>
          <ul className="space-y-2 list-disc list-inside ml-4 text-red-600 font-medium">
            <li>Travel planning and bookings</li>
            <li>Business decisions</li>
            <li>Legal or regulatory compliance</li>
            <li>Financial transactions</li>
            <li>Important personal matters</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">4. LIMITATION OF LIABILITY</h2>
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg">
            <p className="font-semibold text-gray-900 mb-4">COMPLETE LIABILITY DISCLAIMER:</p>
            <p className="mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, HOLIDAYTRIP, ITS OPERATORS, AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, PARTNERS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="space-y-2 list-disc list-inside ml-4">
              <li>Financial losses (including but not limited to lost wages, cancelled travel, rebooked flights, lost deposits)</li>
              <li>Damages arising from travel plans made based on our information</li>
              <li>Damaged electronic devices due to incorrect voltage information</li>
              <li>Missed business opportunities or commercial losses</li>
              <li>Losses due to incorrect price information or currency conversions</li>
              <li>Damages from missed holidays, celebrations, or events</li>
              <li>Any damages arising from reliance on information provided by the Service</li>
              <li>Loss of data, loss of profits, or business interruption</li>
              <li>Personal injury, property damage, or emotional distress</li>
              <li>Any other damages, whether foreseeable or not</li>
            </ul>
          </div>

          <p className="font-semibold mt-6">
            THIS LIMITATION OF LIABILITY APPLIES TO ALL CLAIMS, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>

          <p className="mt-4">
            Some jurisdictions do not allow the exclusion or limitation of certain damages. In such jurisdictions, our liability shall be limited to the maximum extent permitted by law.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">5. "AS IS" WARRANTY DISCLAIMER</h2>
          <p>
            THE SERVICE AND ALL CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>Warranties of merchantability</li>
            <li>Fitness for a particular purpose</li>
            <li>Non-infringement</li>
            <li>Accuracy, completeness, or reliability of content</li>
            <li>Uninterrupted or error-free operation</li>
            <li>Security of the Service</li>
            <li>Any warranty regarding third-party services or links</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">6. User Responsibilities</h2>
          <p>By using our Service, you agree to:</p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>Use the Service only for lawful purposes</li>
            <li>Verify all critical information through official sources</li>
            <li>Not attempt to harm, disable, or disrupt the Service</li>
            <li>Not use automated systems to access the Service without permission</li>
            <li>Not attempt to gain unauthorized access to any portion of the Service</li>
            <li>Not use the Service to transmit harmful content, spam, or malware</li>
            <li>Respect intellectual property rights</li>
            <li>Not reproduce, duplicate, or exploit the Service for commercial purposes without authorization</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">7. User-Generated Content</h2>
          <p>
            If our Service allows you to post comments, reviews, or other content:
          </p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>You are solely responsible for your content</li>
            <li>Content must not be illegal, harmful, threatening, abusive, or discriminatory</li>
            <li>Content must not infringe on any third-party rights</li>
            <li>We reserve the right to remove any content at our discretion</li>
            <li>By posting content, you grant us a worldwide, royalty-free license to use, reproduce, and display it</li>
            <li>We may moderate content using AI systems and human review</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">8. Intellectual Property</h2>
          <p>
            The Service and its original content (excluding user-generated content and content from third-party sources), features, and functionality are and will remain the exclusive property of HolidayTrip and its licensors. The Service is protected by copyright, trademark, and other laws of various jurisdictions.
          </p>
          <p>
            Holiday data, cultural information, and related content are compiled from various public sources and databases, including the Nager.Date API. While the arrangement and presentation are our intellectual property, the underlying data may be publicly available.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">9. Third-Party Links and Services</h2>
          <p>
            Our Service may contain links to third-party websites or services that are not owned or controlled by HolidayTrip. We have no control over, and assume no responsibility for:
          </p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>Content, privacy policies, or practices of third-party websites</li>
            <li>Accuracy or reliability of third-party information</li>
            <li>Products or services offered by third parties</li>
            <li>Transactions made through third-party affiliate links</li>
          </ul>
          <p>
            You acknowledge and agree that HolidayTrip shall not be responsible or liable, directly or indirectly, for any damage or loss caused by the use of or reliance on any third-party content, goods, or services.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">10. Affiliate Disclosure</h2>
          <p>
            HolidayTrip may participate in affiliate programs (including but not limited to Booking.com, Airalo, SafetyWing, and Google AdSense). This means we may earn commissions from qualifying purchases made through links on our Service. This does not affect the price you pay.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">11. Advertising</h2>
          <p>
            Our Service displays advertisements, including those from Google AdSense and other advertising partners. We do not endorse or take responsibility for the products, services, or information provided in advertisements.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">12. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless HolidayTrip and its operators from any claims, damages, losses, liabilities, and expenses (including legal fees) arising out of:
          </p>
          <ul className="space-y-2 list-disc list-inside ml-4">
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of third parties</li>
            <li>Your reliance on information provided by the Service</li>
            <li>Any content you submit or post on the Service</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">13. Service Availability</h2>
          <p>
            We do not guarantee that the Service will be available at all times. We may experience hardware, software, or other problems, or need to perform maintenance, which may result in interruptions, delays, or errors. We reserve the right to modify, suspend, or discontinue the Service (or any part thereof) at any time without notice.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">14. Termination</h2>
          <p>
            We reserve the right to terminate or suspend access to the Service immediately, without prior notice or liability, for any reason, including but not limited to breach of these Terms. Upon termination, your right to use the Service will cease immediately.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">15. Governing Law</h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws of the Republic of Korea, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be subject to the exclusive jurisdiction of the courts of the Republic of Korea.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">16. Changes to Terms</h2>
          <p>
            We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide notice by updating the "Last updated" date. By continuing to access or use the Service after revisions become effective, you agree to be bound by the revised Terms.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">17. Severability</h2>
          <p>
            If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed and interpreted to accomplish the objectives of such provision to the greatest extent possible under applicable law, and the remaining provisions will continue in full force and effect.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">18. Entire Agreement</h2>
          <p>
            These Terms, together with our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>, constitute the entire agreement between you and HolidayTrip regarding the use of the Service.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">19. Contact Information</h2>
          <p>
            If you have any questions about these Terms, please contact us:
          </p>
          <div className="bg-gray-50 rounded-lg p-6 mt-4">
            <p className="font-semibold text-gray-900">HolidayTrip</p>
            <p className="mt-2">Email: <a href="mailto:seansaiid@gmail.com" className="text-blue-600 hover:underline">seansaiid@gmail.com</a></p>
            <p>Website: <Link href="/" className="text-blue-600 hover:underline">holiday-trip.com</Link></p>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg mt-12">
            <p className="font-semibold text-gray-900 mb-2">ACKNOWLEDGMENT</p>
            <p className="text-sm">
              BY USING HOLIDAYTRIP, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE, UNDERSTOOD THEM, AND AGREE TO BE BOUND BY THEM. IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST NOT USE THE SERVICE.
            </p>
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