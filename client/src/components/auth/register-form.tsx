import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ShowTermsDialog } from "@/components/show-terms-dialog";

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
  ageConfirmed: z.boolean().refine((val) => val === true, {
    message: "You must confirm you are at least 18 years old",
  }),
  referralCode: z.string().optional(),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterForm({
  referralCode,
}: {
  referralCode: string | undefined;
}) {
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [otpRequestCount, setOtpRequestCount] = useState(0);
  const [otpCooldown, setOtpCooldown] = useState(0);

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
      ageConfirmed: false,
      referralCode: referralCode || "",
    },
  });

  useEffect(() => {
    if (otpCooldown > 0) {
      const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpCooldown]);

  async function requestVerificationCode(phoneNumber: string) {
    try {
      const res = await fetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Phone number already in use",
          description: "Use a different number or log in to your existing account.",
        });
        return false;
      }
      toast({ title: "Code sent", description: "Check your phone for the verification code." });
      return true;
    } catch {
      toast({
        variant: "destructive",
        title: "SMS unavailable",
        description: "Could not send SMS. Please try again later.",
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleRequestOtp() {
    if (otpRequestCount > 2) {
      toast({ variant: "destructive", title: "Too many attempts", description: "Maximum OTP requests reached." });
      return;
    }
    const phoneNumber = form.getValues("phoneNumber");
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({ variant: "destructive", title: "Invalid phone number", description: "Enter a valid phone number first." });
      return;
    }
    setIsVerifying(true);
    const success = await requestVerificationCode(phoneNumber);
    if (success) {
      setOtpRequestCount((n) => n + 1);
      setOtpCooldown(otpRequestCount === 0 ? 15 : 30);
      setCodeSent(true);
    }
  }

  async function onSubmit(values: RegisterValues) {
    if (Object.keys(form.formState.errors).length > 0) return;
    try {
      setIsSubmitting(true);

      if (!codeSent) {
        await handleRequestOtp();
        return;
      }

      if (!values.verificationCode) {
        toast({ variant: "destructive", title: "Enter verification code", description: "Check your phone for the code." });
        return;
      }

      // Verify OTP
      const verifyRes = await fetch("/api/phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: values.verificationCode, phoneNumber: values.phoneNumber }),
      });
      const verifyResult = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyResult.message || "Invalid verification code");

      // Register
      const formData = new FormData();
      formData.append("firstName", values.firstName);
      formData.append("lastName", values.lastName);
      formData.append("username", values.username);
      formData.append("email", values.email);
      formData.append("password", values.password);
      formData.append("phoneNumber", values.phoneNumber);
      formData.append("verificationCode", values.verificationCode);
      formData.append("termsAccepted", "1");
      formData.append("ageConfirmed", "1");
      formData.append("marketingConsent", "0");
      formData.append("isPhoneVerified", "1");
      formData.append("referralCode", values.referralCode || "");

      const registerRes = await fetch("/api/register", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const registerResult = await registerRes.json();
      if (!registerRes.ok) throw new Error(registerResult.error || registerResult.message || "Registration failed");

      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast({ title: "Welcome to MyKavaBar! 🌿" });
      await new Promise((r) => setTimeout(r, 800));
      setLocation("/");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Registration failed" });
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

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="firstName" render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl><Input placeholder="First" {...field} /></FormControl>
                <FormMessage className="text-red-600 text-xs" />
              </FormItem>
            )} />
            <FormField control={form.control} name="lastName" render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl><Input placeholder="Last" {...field} /></FormControl>
                <FormMessage className="text-red-600 text-xs" />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="username" render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl><Input placeholder="username" {...field} /></FormControl>
              <FormMessage className="text-red-600 text-xs" />
            </FormItem>
          )} />

          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
              <FormMessage className="text-red-600 text-xs" />
            </FormItem>
          )} />

          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl><Input type="password" placeholder="8+ characters" {...field} /></FormControl>
              <FormMessage className="text-red-600 text-xs" />
            </FormItem>
          )} />

          {/* Phone + OTP */}
          <FormField control={form.control} name="phoneNumber" render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="(123) 456-7890" disabled={codeSent} {...field} />
              </FormControl>
              <FormMessage className="text-red-600 text-xs" />
            </FormItem>
          )} />

          {codeSent && (
            <div className="space-y-2">
              <FormField control={form.control} name="verificationCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Code</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="6-digit code" maxLength={6} {...field} />
                  </FormControl>
                  <FormMessage className="text-red-600 text-xs" />
                </FormItem>
              )} />
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={isVerifying || otpCooldown > 0 || otpRequestCount > 2}
                className="text-sm text-primary underline disabled:opacity-40 disabled:cursor-default"
              >
                {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : otpRequestCount > 2 ? "No more attempts" : "Resend code"}
              </button>
            </div>
          )}

          {/* Referral code — only show if pre-filled */}
          {referralCode && (
            <FormField control={form.control} name="referralCode" render={({ field }) => (
              <FormItem>
                <FormLabel>Referral Code</FormLabel>
                <FormControl><Input type="text" placeholder="K-ABC123" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}

          {/* Checkboxes */}
          <div className="space-y-3 border-t pt-4">
            <FormField control={form.control} name="termsAccepted" render={({ field }) => (
              <FormItem className="flex items-start gap-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                </FormControl>
                <div>
                  <FormLabel className="text-sm text-muted-foreground font-normal">
                    I agree to the{" "}
                    <button type="button" className="text-primary underline" onClick={() => setShowTerms(true)}>
                      Terms of Service
                    </button>{" "}
                    and Privacy Policy.
                  </FormLabel>
                  <FormMessage className="text-red-600 text-xs" />
                </div>
              </FormItem>
            )} />

            <FormField control={form.control} name="ageConfirmed" render={({ field }) => (
              <FormItem className="flex items-start gap-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                </FormControl>
                <div>
                  <FormLabel className="text-sm text-muted-foreground font-normal">
                    I confirm I am at least 18 years old.
                  </FormLabel>
                  <FormMessage className="text-red-600 text-xs" />
                </div>
              </FormItem>
            )} />
          </div>

          <Button type="submit" className="w-full" disabled={isVerifying || isSubmitting}>
            {isVerifying || isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isVerifying ? "Sending code…" : "Creating account…"}
              </>
            ) : codeSent ? "Create Account" : "Verify Phone"}
          </Button>

        </form>
      </Form>

      <ShowTermsDialog open={!!showTerms} onOpenChange={setShowTerms} />
    </>
  );
}
