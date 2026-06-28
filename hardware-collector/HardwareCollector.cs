using System;
using System.Management;
using System.Net;
using System.Net.Http;
using System.Text;
using Newtonsoft.Json;
using Microsoft.Win32;

namespace HardwareCollector
{
    // 硬件信息数据类
    public class HardwareInfo
    {
        [JsonProperty("hostname")]
        public string Hostname { get; set; }

        [JsonProperty("cpu")]
        public string Cpu { get; set; }

        [JsonProperty("memory")]
        public string Memory { get; set; }

        [JsonProperty("disk")]
        public string Disk { get; set; }

        [JsonProperty("gpu")]
        public string Gpu { get; set; }

        [JsonProperty("networkCards")]
        public NetworkInfo[] NetworkCards { get; set; }

        [JsonProperty("motherboard")]
        public string Motherboard { get; set; }

        [JsonProperty("os")]
        public string Os { get; set; }

        [JsonProperty("serialNumber")]
        public string SerialNumber { get; set; }

        [JsonProperty("macAddress")]
        public string MacAddress { get; set; }

        [JsonProperty("collectedAt")]
        public string CollectedAt { get; set; }
    }

    public class NetworkInfo
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("mac")]
        public string Mac { get; set; }
    }

    // 服务器响应
    public class UploadResponse
    {
        [JsonProperty("message")]
        public string Message { get; set; }

        [JsonProperty("isUpdate")]
        public bool IsUpdate { get; set; }
    }

    class Program
    {
        private const string BaseUrl = "http://localhost:3000";

        static void Main(string[] args)
        {
            Console.WriteLine("=========================================");
            Console.WriteLine("  电脑资产信息采集工具 v1.0");
            Console.WriteLine("=========================================");
            Console.WriteLine();

            // 获取 Token
            string token = "";
            if (args.Length > 0)
            {
                token = args[0];
            }
            else
            {
                Console.Write("请输入采集 Token: ");
                token = Console.ReadLine();
            }

            if (string.IsNullOrWhiteSpace(token))
            {
                Console.WriteLine("错误：Token 不能为空");
                Console.WriteLine("按任意键退出...");
                Console.ReadKey();
                return;
            }

            Console.WriteLine();
            Console.WriteLine("正在采集硬件信息...");
            Console.WriteLine();

            try
            {
                // 采集硬件信息
                var info = CollectHardware();

                Console.WriteLine("正在上传数据...");

                // 上传数据
                var response = UploadData(token, info);

                Console.WriteLine();
                Console.WriteLine("=========================================", ConsoleColor.Green);
                Console.WriteLine("  上传成功！", ConsoleColor.Green);
                Console.WriteLine("=========================================", ConsoleColor.Green);
                Console.WriteLine();
                Console.WriteLine($"服务器响应：{response.Message}", ConsoleColor.Green);

                if (response.IsUpdate)
                {
                    Console.WriteLine("检测到已有设备记录，已更新硬件信息", ConsoleColor.Yellow);
                }
                else
                {
                    Console.WriteLine("新设备已创建，等待管理员审批", ConsoleColor.Green);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine();
                Console.WriteLine("=========================================", ConsoleColor.Red);
                Console.WriteLine("  操作失败", ConsoleColor.Red);
                Console.WriteLine("=========================================", ConsoleColor.Red);
                Console.WriteLine();
                Console.WriteLine($"错误：{ex.Message}", ConsoleColor.Red);
            }

            Console.WriteLine();
            Console.WriteLine("按任意键退出...");
            Console.ReadKey();
        }

        /// <summary>
        /// 采集硬件信息
        /// </summary>
        static HardwareInfo CollectHardware()
        {
            var info = new HardwareInfo();

            // 主机名
            info.Hostname = Environment.MachineName;

            // CPU 信息
            using (var searcher = new ManagementObjectSearcher("SELECT Name, NumberOfCores, NumberOfLogicalProcessors FROM Win32_Processor"))
            {
                foreach (var obj in searcher.Get())
                {
                    var name = obj["Name"]?.ToString() ?? "Unknown";
                    var cores = obj["NumberOfCores"]?.ToString() ?? "?";
                    var threads = obj["NumberOfLogicalProcessors"]?.ToString() ?? "?";
                    info.Cpu = $"{name} ({cores}核{threads}线程)";
                    break;
                }
            }

            // 内存信息
            ulong totalMemory = 0;
            uint moduleCount = 0;
            using (var searcher = new ManagementObjectSearcher("SELECT Capacity FROM Win32_PhysicalMemory"))
            {
                foreach (var obj in searcher.Get())
                {
                    totalMemory += (ulong)obj["Capacity"];
                    moduleCount++;
                }
            }
            info.Memory = $"{Math.Round(totalMemory / (1024.0 * 1024 * 1024), 2)}GB ({moduleCount}条)";

            // 硬盘信息
            var diskBuilder = new StringBuilder();
            using (var searcher = new ManagementObjectSearcher("SELECT Model, Size FROM Win32_DiskDrive"))
            {
                foreach (var obj in searcher.Get())
                {
                    var model = obj["Model"]?.ToString() ?? "Unknown";
                    var size = obj["Size"] != null ? Math.Round((ulong)obj["Size"] / (1024.0 * 1024 * 1024), 2) + "GB" : "Unknown";
                    if (diskBuilder.Length > 0) diskBuilder.Append(", ");
                    diskBuilder.Append($"{model} {size}");
                }
            }
            info.Disk = diskBuilder.ToString();

            // 显卡信息
            using (var searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_VideoController"))
            {
                foreach (var obj in searcher.Get())
                {
                    info.Gpu = obj["Name"]?.ToString() ?? "Unknown";
                    break;
                }
            }

            // 网卡信息
            var networkCards = new System.Collections.Generic.List<NetworkInfo>();
            string macAddress = "";
            using (var searcher = new ManagementObjectSearcher("SELECT Name, MACAddress, PhysicalAdapter FROM Win32_NetworkAdapter WHERE MACAddress IS NOT NULL AND PhysicalAdapter = TRUE"))
            {
                foreach (var obj in searcher.Get())
                {
                    var netInfo = new NetworkInfo
                    {
                        Name = obj["Name"]?.ToString() ?? "Unknown",
                        Mac = obj["MACAddress"]?.ToString() ?? ""
                    };
                    networkCards.Add(netInfo);
                    if (string.IsNullOrEmpty(macAddress))
                    {
                        macAddress = netInfo.Mac;
                    }
                }
            }
            info.NetworkCards = networkCards.ToArray();
            info.MacAddress = macAddress;

            // 主板信息
            string moboManufacturer = "", moboProduct = "", moboSerial = "";
            using (var searcher = new ManagementObjectSearcher("SELECT Manufacturer, Product, SerialNumber FROM Win32_BaseBoard"))
            {
                foreach (var obj in searcher.Get())
                {
                    moboManufacturer = obj["Manufacturer"]?.ToString() ?? "";
                    moboProduct = obj["Product"]?.ToString() ?? "";
                    moboSerial = obj["SerialNumber"]?.ToString() ?? "";
                    break;
                }
            }
            info.Motherboard = $"{moboManufacturer} {moboProduct} (SN: {moboSerial})";
            info.SerialNumber = moboSerial;

            // 操作系统信息
            using (var searcher = new ManagementObjectSearcher("SELECT Caption, OSArchitecture FROM Win32_OperatingSystem"))
            {
                foreach (var obj in searcher.Get())
                {
                    var caption = obj["Caption"]?.ToString() ?? "Windows";
                    var arch = obj["OSArchitecture"]?.ToString() ?? "";
                    info.Os = $"{caption} {arch}";
                    break;
                }
            }

            // 采集时间
            info.CollectedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

            return info;
        }

        /// <summary>
        /// 上传数据到服务器
        /// </summary>
        static UploadResponse UploadData(string token, HardwareInfo info)
        {
            string json = JsonConvert.SerializeObject(info);

            using (var client = new WebClient())
            {
                client.Headers[HttpRequestHeader.ContentType] = "application/json";
                string uploadUrl = $"{BaseUrl}/api/scan/upload?token={token}";
                string response = client.UploadString(uploadUrl, "POST", json);
                return JsonConvert.DeserializeObject<UploadResponse>(response);
            }
        }
    }
}