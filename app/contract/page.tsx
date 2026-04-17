import Link from 'next/link';

export const metadata = {
  title: 'Contact - HolidayTrip',
  description: 'Get in touch with HolidayTrip. We welcome your questions, feedback, and suggestions.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-8 inline-block">
          ← Back to home
        </Link>

        <h1 className="text-5xl font-bold text-gray-900 mb-8">Contact Us</h1>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <p className="text-xl leading-relaxed">
            We value your feedback and are always happy to hear from our users. Whether you have a question, suggestion, correction, or partnership inquiry, please reach out to us.
          </p>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Get in Touch</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">General Inquiries</h3>
                <p className="text-gray-700">
                  For general questions about our service, content, or website:
                </p>
                <p className="text-blue-600 font-medium mt-1">
                  seansaiid@gmail.com
                </p>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-2">Information Corrections</h3>
                <p className="text-gray-700">
                  Found incorrect or outdated information? Please let us know:
                </p>
                <p className="text-blue-600 font-medium mt-1">
                  seansaiid@gmail.com
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Please include the country, holiday name, and the correct information with your source.
                </p>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-2">Partnership & Business</h3>
                <p className="text-gray-700">
                  For partnership opportunities, advertising inquiries, or business proposals:
                </p>
                <p className="text-blue-600 font-medium mt-1">
                  seansaiid@gmail.com
                </p>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-2">Privacy & Legal</h3>
                <p className="text-gray-700">
                  For privacy concerns, data requests, or legal matters:
                </p>
                <p className="text-blue-600 font-medium mt-1">
                  seansaiid@gmail.com
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">Response Time</h2>
          <p>
            We typically respond to inquiries within 3-5 business days. For urgent matters, please mark your email accordingly.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">Before You Contact Us</h2>
          <p>
            For common questions, please check our other pages:
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li><Link href="/about" className="text-blue-600 hover:underline">About HolidayTrip</Link> - Learn about our service and mission</li>
            <li><Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> - How we handle your data</li>
            <li><Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> - Our usage terms and disclaimers</li>
          </ul>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg mt-8">
            <p className="text-sm">
              <strong>Note:</strong> HolidayTrip is an independent information platform. We are not affiliated with any government agency, tourism board, or travel company unless explicitly stated. All holiday information is provided for reference purposes only.
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