import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ShowTermsDialog } from "@/components/show-terms-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useUser } from "@/hooks/use-user";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

// Step 1 schema: username only
const step0Schema = z.object({
  username: z
    .string()
    .min(3, "Must be at least 3 characters")
    .max(20, "Max 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms",
  }),
  marketingConsent: z.boolean().default(false),
  ageConfirmed: z.boolean().refine((val) => val === true, {
    message: "Age confirmation is required",
  }),
});

// Step 2 schema: phone number only
const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[0-9]{7,15}$/.test(val), {
      message: "Invalid phone number format",
    }),
});

// OTP schema
const otpSchema = z.object({
  phoneNumber: z.string().refine((val) => /^\+?[0-9]{7,15}$/.test(val), {
    message: "Invalid phone number format",
  }),
  otp: z
    .string()
    .min(4, "OTP must be at least 4 digits")
    .max(6, "OTP max 6 digits"),
});

type Step0FormValues = z.infer<typeof step0Schema>;
type PhoneFormValues = z.infer<typeof phoneSchema>;
type OtpFormValues = z.infer<typeof otpSchema>;

const CompleteOnboarding: React.FC = () => {
  const { toast } = useToast();
  const { user } = useUser();
  const [_, navigate] = useLocation();

  // Always guard against missing user
  if (!user) {
    navigate("/");
    return null;
  }

  // Step tracking (0: username, 1: phone, 2: OTP)
  const [step, setStep] = useState<0 | 1 | 2>(
    user.username === null && !user.isPhoneVerified ? 0 : 1,
  );

  // Suggestion logic (for username)
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [showTerms, setShowTerms] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // Store username in state for later steps
  const [username, setUsername] = useState<string>("");

  // RHF for username
  const formStep0 = useForm<Step0FormValues>({
    resolver: zodResolver(step0Schema),
  });
  const {
    register: registerStep0,
    handleSubmit: handleStep0Submit,
    setValue: setStep0,
    control,
    formState: { errors: step0Errors, isSubmitting: step0Submitting },
    watch: watchUsername,
  } = formStep0;

  // RHF for phone
  const {
    register: registerPhone,
    handleSubmit: handlePhoneSubmit,
    formState: { errors: phoneErrors, isSubmitting: phoneSubmitting },
    watch: watchPhone,
  } = useForm<PhoneFormValues>({ resolver: zodResolver(phoneSchema) });

  // RHF for OTP
  const {
    register: registerOtp,
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors, isSubmitting: otpSubmitting },
  } = useForm<OtpFormValues>({ resolver: zodResolver(otpSchema) });

  if (user.isPhoneVerified) navigate("/");
  // Username suggestions fetch
  useEffect(() => {
    if (step !== 0) return;
    setLoadingSuggestions(true);
    fetch("/api/auth/username-suggestions")
      .then((res) => res.json())
      .then((data) => setSuggestions(data.suggestions))
      .catch(() =>
        toast({
          title: "Error",
          description: "Could not load username suggestions",
          variant: "destructive",
        }),
      )
      .finally(() => setLoadingSuggestions(false));
  }, [step]);

  // Handle username submission (step 1: required)
  const onStep0Submit = async (data: Step0FormValues) => {
    try {
      const response = await fetch(
        "/api/auth/complete-onboarding/update-username",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // if using cookies/session
          body: JSON.stringify(data),
        },
      );
      const result = await response.json();
      if (response.ok && result.success) {
        queryClient.invalidateQueries({ queryKey: ["user"] });
        setUsername(data.username); // Save for display/welcome
        setStep(1);
      } else {
        toast({
          title: "Username Error",
          description: result.error || "Could not update username.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Network Error",
        description: "Could not update username.",
        variant: "destructive",
      });
    }
  };

  // Handle phone submission (step 2: optional)
  const onPhoneSubmit = async (data: PhoneFormValues) => {
    const phone = data.phoneNumber;
    if (phone) {
      try {
        const response = await fetch("/api/phone/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ phoneNumber: phone }),
        });
        const result = await response.json();
        if (response.ok && result.success) {
          toast({
            title: "OTP Sent",
            description: `OTP was sent to ${phone}.`,
          });
          setStep(2);
        } else {
          toast({
            title: "Phone Error",
            description: result.error || "Could not send OTP.",
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Network Error",
          description: "Could not send OTP.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Onboarding Complete",
        description: `Welcome, ${username || user.username}!`,
      });
      // Optionally trigger success navigation or further actions here
    }
  };

  // Handle OTP submission (step 3: required if phone provided)
  const onOtpSubmit = async (data: OtpFormValues) => {
    // Simulate OTP verification
    try {
      const response = await fetch(
        "/api/auth/complete-onboarding/verify-phone",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            phoneNumber: data.phoneNumber,
            code: data.otp,
          }),
        },
      );
      const result = await response.json();
      if (response.ok && result.success) {
        queryClient.invalidateQueries({ queryKey: ["user"] });
        navigate("/");
        toast({
          title: "Success",
          description: `OTP was verified successfully`,
        });
        setStep(2);
      } else {
        toast({
          title: "Phone Error",
          description: result.error || "Could not send OTP.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Network Error",
        description: "Could not verify OTP.",
        variant: "destructive",
      });
    }
  };

  // Suggestion click handler
  const onSuggestionClick = (uname: string) => {
    setStep0("username", uname, { shouldValidate: true });
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <div className="mb-6 p-4 border rounded-lg dark:text-white  text-center shadow-sm font-medium">
        Verify your details to enjoy all member benefits like RSVPs, reviews,
        and more.
      </div>
      <h1 className="text-2xl font-semibold mb-6">Complete Your Onboarding</h1>

      {step === 0 && (
        <form onSubmit={handleStep0Submit(onStep0Submit)} className="space-y-6">
          <Form {...formStep0}>
            <div>
              <Label htmlFor="username">Choose a Username *</Label>
              <Input
                id="username"
                {...registerStep0("username")}
                className="mt-1"
                autoComplete="off"
              />
              {loadingSuggestions && (
                <p className="mt-1 text-sm text-gray-600 flex items-center space-x-2">
                  {/* ...spinner svg... */}
                  <span>Suggesting username…</span>
                </p>
              )}
              {step0Errors.username && (
                <p className="text-red-600 text-sm mt-1">
                  {step0Errors.username.message}
                </p>
              )}
              {!loadingSuggestions && suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 font-semibold text-black dark:text-white">
                    Available:
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {suggestions.map((uname) => (
                      <span
                        key={uname}
                        onClick={() => onSuggestionClick(uname)}
                        className={`cursor-pointer dark:text-white text-black transition-colors ${
                          watchUsername("username") === uname
                            ? "text-white font-bold"
                            : "text-gray-700 dark:text-gray-400 hover:dark:text-white hover:text-black"
                        }`}
                      >
                        {uname}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-6 border-t pt-6">
              <FormField
                control={control}
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
                control={control}
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
                control={control}
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
              <ShowTermsDialog open={showTerms} onOpenChange={setShowTerms} />
            </div>
            <Button type="submit" disabled={step0Submitting}>
              Next
            </Button>
          </Form>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={handlePhoneSubmit(onPhoneSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="phoneNumber">Phone Number (optional)</Label>
            <Input
              id="phoneNumber"
              type="tel"
              {...registerPhone("phoneNumber")}
              className="mt-1"
              autoComplete="tel"
              placeholder="234567890"
            />
            {phoneErrors.phoneNumber && (
              <p className="text-red-600 text-sm mt-1">
                {phoneErrors.phoneNumber.message}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={phoneSubmitting}>
              Send OTP & Next
            </Button>
            <Button
              type="button"
              onClick={() => {
                navigate("/");
              }}
            >
              Skip
            </Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleOtpSubmit(onOtpSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="otp">Enter OTP</Label>
            <Input
              id="otp"
              type="text"
              {...registerOtp("otp")}
              className="mt-1"
              autoComplete="off"
              placeholder="4-6 digit code"
            />
            {otpErrors.otp && (
              <p className="text-red-600 text-sm mt-1">
                {otpErrors.otp.message}
              </p>
            )}
          </div>
          {/* Hidden phone number value for validation */}
          <input
            type="hidden"
            {...registerOtp("phoneNumber")}
            value={watchPhone("phoneNumber")}
          />
          <Button type="submit" disabled={otpSubmitting}>
            Complete Onboarding
          </Button>
        </form>
      )}
    </main>
  );
};

export default CompleteOnboarding;
