import { useEffect } from "react";
import { Triangle } from "react-loader-spinner";
import { useNavigate, useParams } from "react-router-dom";

const Loading = () => {
  const { nextUrl } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (nextUrl) {
      setTimeout(() => {
        navigate("/" + nextUrl);
      }, 8000);
    }
  }, []);

  return (
    <div className="flex justify-center items-center h-[100vh]">
      <Triangle
        height="39"
        width="39"
        color="#ED230D"
        ariaLabel="triangle-loading"
        className
        wrapperStyle={{}}
        visible={true}
      />
    </div>
  );
};

export default Loading;
