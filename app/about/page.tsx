import Link from 'next/link';

export const metadata = {
  title: 'About - HolidayTrip',
  description: 'Learn about HolidayTrip, your global guide to holidays and travel information.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-8 inline-block">
          ← Back to home
        </Link>

        <h1 className="text-5xl font-bold text-gray-900 mb-8">About HolidayTrip</h1>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <p className="text-xl leading-relaxed">
            HolidayTrip, operated by <strong>SE Company</strong>, is your comprehensive global guide to public holidays, cultural celebrations, and essential travel information for countries around the world.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">Our Mission</h2>
          <p>
            We believe that understanding local holidays and customs is essential for meaningful travel experiences. Whether you're planning a vacation, scheduling business trips, or simply curious about cultures worldwide, HolidayTrip provides the information you need in one centralized, easy-to-navigate platform.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">What We Offer</h2>
          <ul className="space-y-3 list-disc list-inside">
            <li><strong>Global Holiday Calendar:</strong> Public holidays for 50+ countries across 2025-2027</li>
            <li><strong>Travel Essentials:</strong> Currency, voltage, plug types, and timezone information</li>
            <li><strong>Cultural Context:</strong> Local names and significance of each holiday</li>
            <li><strong>Practical Tips:</strong> Travel advice for holiday periods (coming soon)</li>
            <li><strong>Price Comparisons:</strong> Cost of living insights for travelers (coming soon)</li>
            <li><strong>Community Insights:</strong> Real traveler experiences and recommendations (coming soon)</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">Our Data Sources</h2>
          <p>
            We aggregate holiday information from publicly available sources including government websites, official tourism boards, and established holiday databases such as the Nager.Date API. While we strive for accuracy, holiday dates and details may change due to governmental decisions, calendar variations, or regional differences.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">How We're Different</h2>
          <p>
            Most holiday websites simply list dates. HolidayTrip goes beyond by combining holiday information with practical travel context—helping you understand not just <em>when</em> holidays occur, but <em>what they mean</em> for travelers, locals, and businesses.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">Important Notice</h2>
          <div className="bg-amber-50 border-l-4 border-amber-400 p-6 rounded-r-lg">
            <p className="text-sm">
              <strong>Information Accuracy Disclaimer:</strong> While we make every effort to provide accurate and up-to-date information, HolidayTrip cannot guarantee the completeness or accuracy of any data presented on this website. Holiday dates, cultural practices, prices, voltage information, and other details may change or vary by region. Always verify critical information with official sources before making travel decisions. See our <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> for more details.
            </p>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">Contact Us</h2>
          <p>
            Have questions, suggestions, or feedback? We'd love to hear from you. Visit our <Link href="/contact" className="text-blue-600 hover:underline">Contact page</Link> to get in touch.
          </p>
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