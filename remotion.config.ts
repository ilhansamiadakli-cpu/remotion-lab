import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

// Render çıktılarının varsayılan görüntü formatı ve üzerine yazma davranışı
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Remotion Webpack derleme hattına Tailwind CSS v4 desteğini entegre eder
Config.overrideWebpackConfig(enableTailwind);
