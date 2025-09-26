import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Camera, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import GoogleButton from "./google-auth-button";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string().min(3, "Username must be at least 3 characters").max(20),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phoneNumber: z.string().min(10, "Please enter a valid phone number"),
  verificationCode: z.string().optional(),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
  marketingConsent: z.boolean().default(false),
  referralCode: z.string().optional(),
  ageConfirmed: z.boolean().refine((val) => val === true, {
    message: "You must confirm that you are at least 18 years old",
  }),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterForm({
  referralCode,
}: {
  referralCode: string | undefined;
}) {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const queryClient = useQueryClient();

  // OTP resend management state
  const [otpRequestCount, setOtpRequestCount] = useState(0);
  const [otpCooldown, setOtpCooldown] = useState(0); // seconds remaining cooldown

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
      phoneNumber: "",
      verificationCode: "",
      termsAccepted: false,
      marketingConsent: false,
      referralCode: referralCode || "",
      ageConfirmed: false,
    },
  });

  // Cooldown countdown timer effect
  useEffect(() => {
    if (otpCooldown > 0) {
      const timerId = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [otpCooldown]);

  // Reuse existing function but without changing codeSent inside it
  async function requestVerificationCode(phoneNumber: string) {
    try {
      const response = await fetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Verification request failed:", result);
        toast({
          variant: "destructive",
          title: "Phone number exists",
          description:
            "Please use a different phone number or login with your existing account.",
        });
        return false;
      }
      toast({
        title: "Verification Code Sent",
        description: "Please check your phone for the verification code.",
      });
      return true;
    } catch (error: any) {
      const errorDetails = error.details ? `: ${error.details}` : "";
      toast({
        variant: "destructive",
        title: "SMS Service Unavailable",
        description:
          "Our SMS verification service is currently unavailable. Please try again later or contact support." +
          errorDetails,
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleRequestOtp() {
    if (otpRequestCount > 2) {
      toast({
        variant: "destructive",
        title: "OTP Limit Reached",
        description: "You have reached the maximum number of OTP requests.",
      });
      return;
    }

    setIsVerifying(true);
    const phoneNumber = form.getValues("phoneNumber");
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        variant: "destructive",
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number before requesting OTP.",
      });
      setIsVerifying(false);
      return;
    }

    const success = await requestVerificationCode(phoneNumber);
    setIsVerifying(false);

    if (success) {
      setOtpRequestCount(otpRequestCount + 1);
      // Set cooldown timer according to attempts
      if (otpRequestCount === 0) {
        setOtpCooldown(15);
      } else if (otpRequestCount === 1) {
        setOtpCooldown(30);
      }
      setCodeSent(true);
    }
  }

  const handlePhotoCapture = async () => {
    try {
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], "profile-photo.jpg", {
                type: "image/jpeg",
              });
              handlePhotoFile(file);

              const previewUrl = URL.createObjectURL(blob);
              setPhotoPreviewUrl(previewUrl);
            }
          },
          "image/jpeg",
          0.8,
        );
      }

      const stream = video.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      setShowCamera(false);
      setIsCameraActive(false);
    }
  };

  const handlePhotoFile = (file: File) => {
    setProfilePhoto(file);
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setShowCamera(false);
    setIsCameraActive(false);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePhoto(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  async function onSubmit(values: RegisterValues) {
    if (Object.keys(form.formState.errors).length > 0) {
      console.error("Form validation errors:", form.formState.errors);
      return;
    }

    try {
      setIsSubmitting(true);

      // If code not sent yet, send first OTP and exit
      if (!codeSent) {
        await handleRequestOtp();
        return;
      }

      if (!values.verificationCode) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please enter the verification code",
        });
        return;
      }

      const verifyResponse = await fetch("/api/phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: values.verificationCode,
          phoneNumber: values.phoneNumber,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyResult.message || "Invalid verification code");
      }

      const formData = new FormData();

      formData.append("firstName", values.firstName);
      formData.append("lastName", values.lastName);
      formData.append("username", values.username);
      formData.append("email", values.email);
      formData.append("password", values.password);
      formData.append("phoneNumber", values.phoneNumber);
      if (values.verificationCode) {
        formData.append("verificationCode", values.verificationCode);
      }

      formData.append("termsAccepted", values.termsAccepted ? "1" : "0");
      formData.append("marketingConsent", values.marketingConsent ? "1" : "0");
      formData.append("ageConfirmed", values.ageConfirmed ? "1" : "0");
      formData.append("isPhoneVerified", "1");
      formData.append("referralCode", values.referralCode || "");

      if (profilePhoto) {
        formData.append("profilePhoto", profilePhoto);
      }

      const registerResponse = await fetch("/api/register", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const registerResult = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(
          registerResult.error ||
            registerResult.message ||
            "Registration failed",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["user"] });

      toast({
        title: "Registration Successful",
        description: "Welcome to MyKavaBar!",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setLocation("/");
    } catch (error: any) {
      console.error("Error in form submission:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Registration failed",
      });
      if (error.message?.includes("verification code")) {
        setCodeSent(false);
        setOtpRequestCount(0);
        setOtpCooldown(0);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <FormLabel>Profile Photo</FormLabel>
            <div className="flex flex-col items-center space-y-4">
              {photoPreviewUrl && (
                <div className="relative w-24 h-24 rounded-full overflow-hidden">
                  <img
                    src={photoPreviewUrl}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePhotoCapture}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
                <div className="relative">
                  <Button type="button" variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photo
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                    />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="First name" {...field} />
                  </FormControl>
                  <FormMessage className="text-red-600 mt-1" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Last name" {...field} />
                  </FormControl>
                  <FormMessage className="text-red-600 mt-1" />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="username" {...field} />
                </FormControl>
                <FormMessage className="text-red-600 mt-1" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-600 mt-1" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="********" {...field} />
                </FormControl>
                <FormMessage className="text-red-600 mt-1" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="(123) 456-7890"
                    disabled={codeSent}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-600 mt-1" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="referralCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Referral Code (Optional)</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="K-ABC123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {codeSent && (
            <>
              <FormField
                control={form.control}
                name="verificationCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter code"
                        maxLength={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-600 mt-1" />
                  </FormItem>
                )}
              />
              {/* <button
                type="button"
                onClick={handleRequestOtp}
                disabled={isVerifying || otpCooldown > 0 || otpRequestCount > 2}
                className={`
                  font-medium text-sm underline text-primary
                  ${isVerifying || otpCooldown > 0 || otpRequestCount > 2 ? "pointer-events-none opacity-50 cursor-default" : "cursor-pointer"}
                `}
              >
                {otpCooldown > 0
                  ? `Resend OTP in ${otpCooldown}s`
                  : otpRequestCount > 2
                    ? "No More OTP Attempts"
                    : "Resend OTP"}
              </button> */}
            </>
          )}

          <div className="space-y-6 border-t pt-6">
            <FormField
              control={form.control}
              name="termsAccepted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm text-muted-foreground">
                      I have read, understand, and agree to MyKavaBar.com's{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setShowTerms(true)}
                      >
                        Terms of Service
                      </button>{" "}
                      and Privacy Policy.
                    </FormLabel>
                    <FormMessage className="text-red-600 mt-1" />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="marketingConsent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm text-muted-foreground">
                      I consent to receiving marketing communications and
                      understand I can unsubscribe at any time.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ageConfirmed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm text-muted-foreground">
                      I confirm that I am at least 18 years old.
                    </FormLabel>
                    <FormMessage className="text-red-600 mt-1" />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              By submitting this form, you agree to receive texts, emails, and
              push notifications from MyKavaBar.com and bars you follow or
              subscribe to. These may include updates, promotions, and event
              reminders. Message and data rates may apply. Frequency may vary.
              You can unsubscribe anytime by replying STOP, clicking unsubscribe
              links, or updating your preferences.
            </p>

            <Button
              type="submit"
              className="w-full"
              disabled={isVerifying || isSubmitting}
            >
              {isVerifying || isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isVerifying ? "Sending Code" : "Creating Account"}
                </>
              ) : codeSent ? (
                "Create Account"
              ) : (
                "Verify Phone"
              )}
            </Button>
          </div>
        </form>
      </Form>

      <GoogleButton />

      <Dialog
        open={showCamera}
        onOpenChange={() => {
          if (showCamera) {
            closeCamera();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take Profile Photo</DialogTitle>
          </DialogHeader>
          <div className="relative w-full" style={{ aspectRatio: "1/1" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover rounded-md"
              style={{ transform: "scaleX(-1)" }}
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <Button type="button" variant="secondary" onClick={closeCamera}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="button" onClick={capturePhoto}>
                <Camera className="mr-2 h-4 w-4" />
                Capture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Terms and Conditions Dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
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
                  By accessing and using MyKavaBar.com ("the Website"), you
                  ("the User") agree to comply with and be bound by these Terms
                  and Conditions ("Terms"). If you do not agree with these
                  Terms, please do not use the Website.
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
                  intended solely for residents of the United States. By using
                  the Website, you affirm that you are a U.S. resident.
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
                  All content on the Website, including text, graphics, logos,
                  and images, is the property of MyKavaBar.com or its content
                  suppliers and is protected by applicable intellectual property
                  laws. Unauthorized use of any content is prohibited.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">
                  5. User-Generated Content
                </h3>
                <p>If the Website allows users to submit content:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>
                    Responsibility: Users are solely responsible for the content
                    they submit.
                  </li>
                  <li>
                    License: By submitting content, you grant MyKavaBar.com a
                    non-exclusive, royalty-free, perpetual, and worldwide
                    license to use, reproduce, and distribute such content.
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
                  Your use of the Website is also governed by our Privacy
                  Policy. Please review it to understand our practices.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">7. Disclaimers</h3>
                <p>
                  No Medical Advice: The content on the Website is for
                  informational purposes only and does not constitute medical
                  advice. Consult with a healthcare professional before
                  consuming kava products.
                </p>
                <p className="mt-2">
                  No Warranties: The Website is provided "as is" without any
                  warranties, express or implied. MyKavaBar.com does not
                  guarantee the accuracy or completeness of the content.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">
                  8. Limitation of Liability
                </h3>
                <p>
                  To the fullest extent permitted by law, MyKavaBar.com shall
                  not be liable for any indirect, incidental, or consequential
                  damages arising from your use of the Website.
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
                  We reserve the right to terminate or suspend your access to
                  the Website, without prior notice or liability, for any reason
                  whatsoever, including without limitation if you breach the
                  Terms.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-2">11. User Accounts</h3>
                <p>
                  If you create an account on the Website, you are responsible
                  for maintaining the confidentiality of your account
                  information and for all activities that occur under your
                  account. You agree to notify us immediately of any
                  unauthorized use of your account.
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
                  MyKavaBar.com regarding the use of the Website and supersede
                  any prior agreements between you and MyKavaBar.com.
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
    </>
  );
}
