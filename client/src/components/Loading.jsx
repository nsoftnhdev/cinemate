import { Triangle } from "react-loader-spinner";

const Loading = () => {
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
