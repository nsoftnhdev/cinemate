import { ArrowRight, CalendarIcon, ClockIcon } from "lucide-react";
import { assets } from "../assets/assets";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <div className='flex flex-col items-start justify-center gap-4 px-6 md:px-16 lg:px-36 bg-[url("/backgroundImage.png")] bg-cover h-screen bg-top'>
      <img src={assets.marvelLogo} alt="" className="max-h-11 lg:h-11 mt-20" />

      <h1 className="text-5xl md:text-[70px] md:leading-18 font-semibold maw-w-110">
        IRONHEART
        <br />
      </h1>

      <div className="flex items-center gap-4 text-gray-300">
        <span>Action | Adventure | Sci-Fi</span>
        <div className="flex items-center gap-1">
          <CalendarIcon className="w-4.5 h-4.5" /> 2025
        </div>
        <div className="flex items-center gap-1">
          <ClockIcon className="w-4.5 h-4.5" /> 1 Seasons - 6 Episodes
        </div>
      </div>
      <p className="max-w-md text-gray-300">
        Riri Williams, a young, genius inventor determined to
        make her mark on the world, returns to her hometown of Chicago. Her
        unique take on building iron suits is brilliant, but in pursuit of her
        ambitions, she finds herself wrapped up with the mysterious yet charming
        Parker Robbins aka "The Hood."
      </p>
      <button
        onClick={() => navigate("/movies")}
        className="flex items-center gap-1 px-6 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-full font-medium cursor-pointer"
      >
        Explore Movies
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default HeroSection;
