import { ImageWithFallback } from "@/pages/profile";

const CheckInCarousel = ({ checkIns }: { checkIns: any[] }) => {
    if (!checkIns || checkIns.length === 0) return null;

    return (
        <div className="mb-4 mt-5">
            <h1 className="text-lg font-semibold mb-2">
                Your favorite{" "}
                {checkIns.length == 1 ? "Kavatender" : "Kavatenders"}{" "}
                {checkIns.length === 1 ? "is" : "are"} working
            </h1>
            {JSON.stringify(checkIns)}
            <div className="flex items-center gap-2">
                {checkIns.map((checkIn: any) => (
                    <>
                        <div className="flex items-center flex-col">
                            <ImageWithFallback
                                key={checkIn.id}
                                src={
                                    checkIn.profilePhotoUrl ||
                                    "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                                }
                                alt={checkIn.firstName || "Profile image"}
                                className="w-16 h-16 rounded-full object-cover"
                            />
                            <h3 className="text-sm font-semibold">
                                {checkIn.firstName || "REDACTED"}{" "}
                            </h3>
                        </div>
                    </>
                ))}
            </div>
        </div>
    );
};

export default CheckInCarousel;
