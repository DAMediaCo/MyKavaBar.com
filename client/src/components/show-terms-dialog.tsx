import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
interface ShowTermsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShowTermsDialog: React.FC<ShowTermsProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Terms and Conditions</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm">
            <p className="font-semibold">Last Updated: February 09, 2025</p>

            <section>
              <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
              <p>
                By accessing and using MyKavaBar.com ("the Website"), you ("the
                User") agree to comply with and be bound by these Terms and
                Conditions ("Terms"). If you do not agree with these Terms,
                please do not use the Website.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">2. Eligibility</h3>
              <p>
                Age Requirement: Users must be at least 18 years old to access
                and use the Website.
              </p>
              <p className="mt-2">
                Geographic Limitation: Access to and use of the Website are
                intended solely for residents of the United States. By using the
                Website, you affirm that you are a U.S. resident.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">3. User Conduct</h3>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Violate any applicable laws or regulations.</li>
                <li>
                  Post or transmit any harmful, threatening, or offensive
                  content.
                </li>
                <li>
                  Attempt to gain unauthorized access to any part of the
                  Website.
                </li>
                <li>
                  Use the Website for any unlawful or fraudulent purposes.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">
                4. Intellectual Property Rights
              </h3>
              <p>
                All content on the Website, including text, graphics, logos, and
                images, is the property of MyKavaBar.com or its content
                suppliers and is protected by applicable intellectual property
                laws. Unauthorized use of any content is prohibited.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">5. User-Generated Content</h3>
              <p>If the Website allows users to submit content:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>
                  Responsibility: Users are solely responsible for the content
                  they submit.
                </li>
                <li>
                  License: By submitting content, you grant MyKavaBar.com a
                  non-exclusive, royalty-free, perpetual, and worldwide license
                  to use, reproduce, and distribute such content.
                </li>
                <li>
                  Prohibited Content: Users must not submit content that is
                  defamatory, infringing, or violates any laws.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">6. Privacy Policy</h3>
              <p>
                Your use of the Website is also governed by our Privacy Policy.
                Please review it to understand our practices.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">7. Disclaimers</h3>
              <p>
                No Medical Advice: The content on the Website is for
                informational purposes only and does not constitute medical
                advice. Consult with a healthcare professional before consuming
                kava products.
              </p>
              <p className="mt-2">
                No Warranties: The Website is provided "as is" without any
                warranties, express or implied. MyKavaBar.com does not guarantee
                the accuracy or completeness of the content.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">8. Limitation of Liability</h3>
              <p>
                To the fullest extent permitted by law, MyKavaBar.com shall not
                be liable for any indirect, incidental, or consequential damages
                arising from your use of the Website.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">9. Indemnification</h3>
              <p>
                You agree to indemnify and hold harmless MyKavaBar.com and its
                affiliates from any claims, damages, or expenses arising from
                your use of the Website or violation of these Terms.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">10. Termination</h3>
              <p>
                We reserve the right to terminate or suspend your access to the
                Website, without prior notice or liability, for any reason
                whatsoever, including without limitation if you breach the
                Terms.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">11. User Accounts</h3>
              <p>
                If you create an account on the Website, you are responsible for
                maintaining the confidentiality of your account information and
                for all activities that occur under your account. You agree to
                notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">
                12. Links to Third-Party Websites
              </h3>
              <p>
                The Website may contain links to third-party websites or
                services that are not owned or controlled by MyKavaBar.com. We
                have no control over, and assume no responsibility for, the
                content, privacy policies, or practices of any third-party
                websites or services.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">13. Governing Law</h3>
              <p>
                These Terms are governed by the laws of the State of [Your
                State], without regard to its conflict of law principles.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">14. Dispute Resolution</h3>
              <p>
                Any disputes arising from the use of the Website will be
                resolved through binding arbitration in accordance with the
                rules of the American Arbitration Association.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">15. Entire Agreement</h3>
              <p>
                These Terms constitute the entire agreement between you and
                MyKavaBar.com regarding the use of the Website and supersede any
                prior agreements between you and MyKavaBar.com.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">16. Contact Information</h3>
              <p>
                For any questions or concerns regarding these Terms, please
                contact us at:
              </p>
              <p className="mt-2">Email: info@mykavabar.com</p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
