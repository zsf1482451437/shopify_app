import { useCallback, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Text,
  Card,
  Layout,
  BlockStack,
  Box,
  InlineStack,
  Modal,
  Button,
  Collapsible,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

const template = "product";
const clientId = "84179925f56dcd207ff9ff58b4265d41";
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop; // 这将获取当前商店的域名

  return {
    shopDomain,
  };
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const { shopDomain } = data;
  const navigate = useNavigate();
  // 设置指南步骤状态
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  // 视频弹窗状态
  const [videoModalActive, setVideoModalActive] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState("");
  const [currentVideoTitle, setCurrentVideoTitle] = useState("");

  // 打开视频弹窗
  const openVideoModal = (videoId: string, videoTitle: string) => {
    setCurrentVideoId(videoId);
    setCurrentVideoTitle(videoTitle);
    setVideoModalActive(true);
  };

  // 关闭视频弹窗
  const closeVideoModal = () => {
    setVideoModalActive(false);
    // 重置视频ID以停止播放
    setCurrentVideoId("");
  };

  // 视频数据
  const videos = [
    {
      id: "SVQ7_CrdGpw",
      title: "How to create a simple option set?",
      duration: "01:08",
    },
  ];

  // 步骤数据
  const setupSteps = [
    {
      id: "add-extension",
      title: "Add OPTIS Product Option to your theme",
      description: "Enable BSS Theme App Extension on your Shopify theme.",
      buttonText: "Add to your theme",
      buttonAction: () => {
        window.open(
          `https://${shopDomain}/admin/themes/current/editor?template=${template}&addAppBlockId=${clientId}/customer_review&target=newAppsSection`,
        );
      },
      completed: false,
    },
    {
      id: "customize-options",
      title: "Customize your first option set",
      description: "start creating right away.",
      buttonText: "Create option set",
      buttonAction: () => {
        navigate("/app/options-create");
      },
      completed: false,
    },
  ];

  // 切换步骤展开状态
  const toggleStep = useCallback(
    (index: number) => {
      setExpandedStep(expandedStep === index ? null : index);
    },
    [expandedStep],
  );
  return (
    <Page>
      <TitleBar title="TT-Options" />
      <BlockStack gap="500">
        <Text as="h1" variant="headingXl" alignment="start">
          Dashboard
        </Text>
      </BlockStack>
      <Box paddingBlockStart="300">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text
                  as="p"
                  variant="bodyLg"
                  alignment="start"
                  fontWeight="bold"
                >
                  Save 60% setup time in just 1 minute - Watch these 1 quick
                  videos!
                </Text>

                <Box>
                  <BlockStack gap="500">
                    <InlineStack
                      gap="500"
                      align="center"
                      blockAlign="start"
                      wrap={false}
                    >
                      {videos.map((video, index) => (
                        <Box
                          key={index}
                          padding="0"
                          width="100%"
                          borderColor="border"
                        >
                          <div
                            style={{ position: "relative" }}
                            onClick={() =>
                              openVideoModal(video.id, video.title)
                            }
                          >
                            <img
                              src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                              alt={video.title}
                              style={{
                                width: "100%",
                                height: "auto",
                                display: "block",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                backgroundColor: "rgba(0, 0, 0, 0.4)",
                                padding: "0 15px",
                                textAlign: "center",
                              }}
                            >
                              <Text
                                as="p"
                                variant="headingXl"
                                fontWeight="bold"
                                tone="text-inverse"
                              >
                                {video.title}
                              </Text>

                              <div
                                style={{
                                  marginTop: "20px",
                                  width: "60px",
                                  height: "60px",
                                  backgroundColor: "rgba(255, 0, 0, 0.8)",
                                  borderRadius: "50%",
                                  display: "flex",
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                <div
                                  style={{
                                    width: 0,
                                    height: 0,
                                    borderTop: "15px solid transparent",
                                    borderBottom: "15px solid transparent",
                                    borderLeft: "20px solid white",
                                    marginLeft: "5px",
                                  }}
                                ></div>
                              </div>
                            </div>

                            <div
                              style={{
                                position: "absolute",
                                bottom: "10px",
                                left: "10px",
                                backgroundColor: "rgba(0, 0, 0, 0.7)",
                                color: "white",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "16px",
                                fontWeight: "bold",
                                zIndex: 2,
                              }}
                            >
                              {video.duration}
                            </div>
                          </div>
                        </Box>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Box>
      <Box paddingBlockStart="400">
        <Card>
          <BlockStack gap="400">
            <Box
              paddingBlockStart="400"
              paddingInlineStart="400"
              paddingInlineEnd="400"
            >
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Setup Guide
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Let's get you started!
                  </Text>
                </BlockStack>
                <Text as="p" variant="bodySm">
                  1 / 2 Completed
                </Text>
              </InlineStack>
            </Box>
            {setupSteps.map((step, index) => (
              <div
                key={step.id}
                onClick={() => toggleStep(index)}
                style={{ cursor: "pointer" }}
              >
                <Box
                  key={step.id}
                  paddingInlineStart="400"
                  paddingInlineEnd="400"
                  paddingBlockEnd={
                    index === setupSteps.length - 1 ? "400" : "0"
                  }
                >
                  <BlockStack gap="200">
                    {/* 步骤标题行 - 可点击展开/收起 */}
                    <Box
                      padding="300"
                      borderColor={
                        expandedStep === index ? "border-emphasis" : "border"
                      }
                      background={
                        expandedStep === index
                          ? "bg-surface-secondary"
                          : "bg-surface"
                      }
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="300" blockAlign="center">
                          <div
                            style={{
                              width: "24px",
                              height: "24px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "20px",
                                height: "20px",
                                border: "1px dashed #8A8A8A",
                                borderRadius: "50%",
                              }}
                            ></div>
                          </div>
                          <Text
                            as="span"
                            variant="bodyMd"
                            fontWeight="semibold"
                          >
                            {step.title}
                          </Text>
                        </InlineStack>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {expandedStep === index ? "Collapse" : "Expand"}
                        </Text>
                      </InlineStack>
                    </Box>

                    {/* 步骤详细内容 - 可折叠 */}
                    <Collapsible
                      open={expandedStep === index}
                      id={`setup-step-${index}`}
                    >
                      <Box paddingInlineStart="500" paddingBlockEnd="300">
                        <BlockStack gap="300">
                          <Text as="p" variant="bodyMd">
                            {step.description}
                          </Text>
                          <div>
                            <Button
                              onClick={step.buttonAction}
                              variant={index === 0 ? "primary" : "secondary"}
                            >
                              {step.buttonText}
                            </Button>
                          </div>
                        </BlockStack>
                      </Box>
                    </Collapsible>
                  </BlockStack>
                </Box>
              </div>
            ))}
          </BlockStack>
        </Card>
      </Box>
      {/* 视频弹窗 */}
      <Modal
        open={videoModalActive}
        onClose={closeVideoModal}
        title={currentVideoTitle}
        primaryAction={{
          content: "关闭",
          onAction: closeVideoModal,
        }}
        size="large"
      >
        <Modal.Section>
          <div
            style={{
              position: "relative",
              paddingBottom: "56.25%",
              height: 0,
              overflow: "hidden",
            }}
          >
            {videoModalActive && (
              <iframe
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
                src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=0&rel=0`}
                title={currentVideoTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            )}
          </div>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
